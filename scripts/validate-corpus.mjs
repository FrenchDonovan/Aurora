import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');
export const countWords = text => typeof text === 'string' ? text.trim().split(/\s+/u).filter(Boolean).length : 0;
const nonempty = x => typeof x === 'string' && x.trim().length > 0;
const date = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x));
const arxiv = x => {
  try { const u = new URL(x); return u.protocol === 'https:' && u.hostname === 'arxiv.org' && !u.username && !u.password && /^\/abs\/\d{4}\.\d{4,5}v\d+$/.test(u.pathname) && !u.search && !u.hash; } catch { return false; }
};
const licenseUrl = x => {
  try { const u = new URL(x); return u.protocol === 'https:' && ['arxiv.org', 'creativecommons.org'].includes(u.hostname) && !u.username && !u.password; } catch { return false; }
};

// Structural integrity only: a successful check does not prove a quote matches a remote source.
export function validateCorpus(corpus) {
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };
  if (!corpus || typeof corpus !== 'object' || Array.isArray(corpus)) return { valid: false, errors: ['corpus must be an object'] };
  check(corpus.schema_version === 1, 'unsupported corpus schema_version');
  for (const key of ['corpus_version', 'domain', 'provenance_note']) check(nonempty(corpus[key]), `missing ${key}`);
  check(date(corpus.updated_at), 'invalid updated_at');
  for (const key of ['papers', 'passages', 'challenges']) check(Array.isArray(corpus[key]), `${key} must be an array`);
  const papers = Array.isArray(corpus.papers) ? corpus.papers : [];
  const passages = Array.isArray(corpus.passages) ? corpus.passages : [];
  const challenges = Array.isArray(corpus.challenges) ? corpus.challenges : [];
  check(papers.length > 0, 'empty papers'); check(passages.length > 0, 'empty passages');
  const ids = new Set(), paperMap = new Map(), passageMap = new Map(), sourceWords = new Map();
  const id = (item, type) => {
    if (!item || typeof item !== 'object') { errors.push(`invalid ${type} object`); return false; }
    check(nonempty(item.id) && /^[a-z0-9][a-z0-9-]+$/.test(item.id), `invalid ${type} id`);
    check(!ids.has(item.id), `duplicate id ${item.id}`); ids.add(item.id); return true;
  };
  for (const p of papers) {
    if (!id(p, 'paper')) continue;
    paperMap.set(p.id, p);
    check(nonempty(p.title), `${p.id}: missing title`);
    check(Array.isArray(p.authors) && p.authors.length > 0 && p.authors.every(nonempty), `${p.id}: invalid authors`);
    check(Number.isInteger(p.year) && p.year >= 1900 && p.year <= Number(typeof corpus.updated_at === 'string' ? corpus.updated_at.slice(0, 4) : NaN), `${p.id}: invalid year`);
    check(arxiv(p.url), `${p.id}: invalid canonical source URL`);
    check(/^v[1-9]\d*$/.test(p.version ?? '') && typeof p.url === 'string' && p.url.endsWith(p.version), `${p.id}: unpinned or inconsistent version`);
    check(date(p.accessed_at), `${p.id}: invalid access date`);
    check(p.source_kind === 'arxiv_abstract', `${p.id}: unexpected source kind`);
    check(Array.isArray(p.topics) && p.topics.length > 0 && p.topics.every(nonempty), `${p.id}: missing topics`);
    check(nonempty(p.curator_note), `${p.id}: missing curator note`);
    check(p.license && ['unknown', 'verified', 'restricted'].includes(p.license.status), `${p.id}: invalid license status`);
    if (p.license) {
      check(p.license.source_url === null || licenseUrl(p.license.source_url), `${p.id}: invalid license source URL`);
      if (p.license.status === 'unknown') check(p.license.id === null, `${p.id}: unknown permission cannot claim a license id`);
      if (p.license.status === 'verified') check(nonempty(p.license.id) && licenseUrl(p.license.source_url), `${p.id}: verified license requires evidence`);
    }
  }
  for (const p of passages) {
    if (!id(p, 'passage')) continue;
    passageMap.set(p.id, p);
    const paper = paperMap.get(p.paper_id);
    check(!!paper, `${p.id}: missing paper reference`);
    check(nonempty(p.text), `${p.id}: empty excerpt`);
    check(p.text_kind === 'verbatim_excerpt', `${p.id}: source wording must be verbatim_excerpt`);
    check(nonempty(p.section) && nonempty(p.curator_note), `${p.id}: missing provenance/context`);
    check(arxiv(p.source_url) && p.source_url === paper?.url, `${p.id}: source URL differs from paper`);
    check(typeof p.text_sha256 === 'string' && p.text_sha256 === sha256(typeof p.text === 'string' ? p.text : ''), `${p.id}: missing or mismatched excerpt SHA-256`);
    const source = typeof paper?.url === 'string' ? paper.url.replace(/v\d+$/, '') : p.paper_id;
    sourceWords.set(source, (sourceWords.get(source) ?? 0) + countWords(p.text));
  }
  for (const [source, words] of sourceWords) check(words <= 25, `${source}: ${words} quoted words exceeds 25-word source budget`);
  for (const p of papers) check(passages.some(x => x?.paper_id === p.id), `${p.id}: no indexed excerpt`);
  for (const c of challenges) {
    if (!id(c, 'challenge')) continue;
    for (const key of ['question', 'claim', 'description']) check(nonempty(c[key]), `${c.id}: missing ${key}`);
    check(c.development_only === true, `${c.id}: public challenge must be development_only`);
    check(c.review && nonempty(c.review.reviewer) && typeof c.review.independent_human_review === 'boolean' && date(c.review.date), `${c.id}: missing review provenance`);
    check(Array.isArray(c.relations) && c.relations.length > 0, `${c.id}: missing reviewed relations`);
    const seen = new Set();
    for (const r of Array.isArray(c.relations) ? c.relations : []) {
      if (!r || typeof r !== 'object') { errors.push(`${c.id}: invalid relation`); continue; }
      check(passageMap.has(r.passage_id), `${c.id}: missing relation passage`);
      check(!seen.has(r.passage_id), `${c.id}: duplicate relation passage`); seen.add(r.passage_id);
      check(['supports', 'challenges', 'qualifies', 'context'].includes(r.relation), `${c.id}: unknown relation`);
      check(nonempty(r.rationale), `${c.id}: missing relation rationale`);
    }
  }
  return { valid: errors.length === 0, errors, summary: { papers: papers.length, passages: passages.length, development_challenges: challenges.length, quoted_words: [...sourceWords.values()].reduce((a,b) => a+b, 0) } };
}

export function validateEvaluation(evaluation) {
  const errors = [];
  if (evaluation?.schema_version !== 1) errors.push('unsupported evaluation schema');
  if (!['not_run', 'pilot', 'validated'].includes(evaluation?.status)) errors.push('invalid evaluation status');
  for (const key of ['metrics', 'runs', 'engineering_checks']) if (!Array.isArray(evaluation?.[key])) errors.push(`${key} must be an array`);
  if (evaluation?.status === 'not_run' && (evaluation?.metrics?.length || evaluation?.runs?.length)) errors.push('not_run cannot contain performance metrics or runs');
  if (!nonempty(evaluation?.note)) errors.push('missing evaluation note');
  return { valid: errors.length === 0, errors };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const corpusPath = process.argv[2] || fileURLToPath(new URL('../web/data/corpus.json', import.meta.url));
  const evaluationPath = fileURLToPath(new URL('../web/data/evaluation.json', import.meta.url));
  try {
    const corpus = validateCorpus(JSON.parse(await readFile(corpusPath, 'utf8')));
    const evaluation = validateEvaluation(JSON.parse(await readFile(evaluationPath, 'utf8')));
    console.log(JSON.stringify({ corpus, evaluation }, null, 2));
    if (!corpus.valid || !evaluation.valid) process.exitCode = 1;
  } catch (error) { console.error(`Data validation failed: ${error.message}`); process.exitCode = 1; }
}
