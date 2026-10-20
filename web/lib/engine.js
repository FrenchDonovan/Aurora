/** Aurora's deterministic, browser-only relevance engine. No network/model calls. */
export const FEATURE_VERSION = 'aurora-lexical-v1';
export const FEATURE_NAMES = Object.freeze(['log1p_bm25', 'passage_coverage', 'title_coverage', 'bigram_coverage', 'token_jaccard', 'length_saturation', 'numeric_coverage', 'tag_coverage']);
export const STOPWORDS = Object.freeze(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'does', 'for', 'from', 'how', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'was', 'what', 'when', 'which', 'with']);
const stop = new Set(STOPWORDS);
const FIELD_WEIGHTS = Object.freeze({ text: 1, title: 0.35, tags: 0.15 });
const relationTypes = new Set(['supports', 'challenges', 'qualifies', 'context']);
const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const invariant = (condition, message) => { if (!condition) throw new Error(message); };
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const https = value => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; } };
const normalizeQuestion = value => value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
const unique = values => [...new Set(values)];
export const tokenize = text => (String(text).normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(token => !stop.has(token));

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort(cmp).map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

// Synchronous SHA-256 keeps receipt identities identical in browsers and offline Python.
export function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const size = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(size); padded.set(bytes); padded[bytes.length] = 128;
  const view = new DataView(padded.buffer);
  view.setUint32(size - 8, Math.floor(bytes.length / 0x20000000)); view.setUint32(size - 4, bytes.length * 8 >>> 0);
  const constants = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const state = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rotate = (x, n) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < size; offset += 64) {
    const w = new Uint32Array(64);
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) { const x = w[i-15], y = w[i-2]; w[i] = (w[i-16] + (rotate(x,7)^rotate(x,18)^(x>>>3)) + w[i-7] + (rotate(y,17)^rotate(y,19)^(y>>>10))) >>> 0; }
    let [a,b,c,d,e,f,g,h] = state;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotate(e,6)^rotate(e,11)^rotate(e,25)) + ((e&f)^((~e)&g)) + constants[i] + w[i]) >>> 0;
      const t2 = ((rotate(a,2)^rotate(a,13)^rotate(a,22)) + ((a&b)^(a&c)^(b&c))) >>> 0;
      h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    [a,b,c,d,e,f,g,h].forEach((v, i) => { state[i] = (state[i] + v) >>> 0; });
  }
  return state.map(value => value.toString(16).padStart(8, '0')).join('');
}

export function corpusHash(corpus) { return sha256(canonical(corpus)); }

function validateCorpus(corpus) {
  invariant(isRecord(corpus) && corpus.schema_version === 1, 'Unsupported corpus schema_version; expected 1.');
  invariant(nonempty(corpus.corpus_version) && nonempty(corpus.domain), 'Corpus needs a version and domain.');
  for (const field of ['papers', 'passages', 'challenges']) invariant(Array.isArray(corpus[field]), `Corpus ${field} must be an array.`);
  const papers = new Map();
  for (const paper of corpus.papers) {
    invariant(isRecord(paper) && nonempty(paper.id) && !papers.has(paper.id), 'Paper IDs must be nonempty and unique.');
    invariant(nonempty(paper.title) && https(paper.url), `Invalid title or HTTPS URL for paper ${paper.id}.`);
    invariant(Array.isArray(paper.authors) && (paper.authors.length > 0 || paper.dataset_partition) && paper.authors.every(nonempty), `Invalid authors for ${paper.id}.`);
    invariant(Number.isInteger(paper.year) && paper.year >= 1900 && paper.year <= 2200, `Invalid year for ${paper.id}.`);
    invariant(Array.isArray(paper.topics) && paper.topics.every(nonempty) && typeof paper.curator_note === 'string', `Invalid topics/note for ${paper.id}.`);
    invariant(isRecord(paper.license) && ['unknown','verified','restricted'].includes(paper.license.status), `Invalid license status for ${paper.id}.`);
    papers.set(paper.id, paper);
  }
  const passages = new Map();
  for (const passage of corpus.passages) {
    invariant(isRecord(passage) && nonempty(passage.id) && !passages.has(passage.id), 'Passage IDs must be nonempty and unique.');
    invariant(papers.has(passage.paper_id), `Unknown paper for passage ${passage.id}.`);
    invariant(nonempty(passage.text) && passage.text.length <= 12000 && ['verbatim_excerpt','dataset_paragraph'].includes(passage.text_kind), `Invalid source text for passage ${passage.id}.`);
    invariant(nonempty(passage.section) && https(passage.source_url) && typeof passage.curator_note === 'string', `Invalid provenance for passage ${passage.id}.`);
    if (passage.text_sha256 !== undefined) invariant(passage.text_sha256 === sha256(passage.text), `Text hash mismatch for ${passage.id}.`);
    passages.set(passage.id, passage);
  }
  const challengeIds = new Set();
  for (const challenge of corpus.challenges) {
    invariant(isRecord(challenge) && nonempty(challenge.id) && !challengeIds.has(challenge.id), 'Challenge IDs must be nonempty and unique.');
    invariant(nonempty(challenge.question) && nonempty(challenge.claim) && challenge.development_only === true && Array.isArray(challenge.relations), `Invalid development challenge ${challenge.id}.`);
    const refs = new Set();
    for (const relation of challenge.relations) {
      invariant(isRecord(relation) && passages.has(relation.passage_id) && !refs.has(relation.passage_id) && relationTypes.has(relation.relation) && nonempty(relation.rationale), `Invalid relation in ${challenge.id}.`);
      refs.add(relation.passage_id);
    }
    challengeIds.add(challenge.id);
  }
}

function indexCorpus(corpus) {
  const papers = new Map(corpus.papers.map(paper => [paper.id, paper]));
  const docs = corpus.passages.map(passage => {
    const paper = papers.get(passage.paper_id);
    const fields = { text: tokenize(passage.text), title: tokenize(paper.title), tags: tokenize(paper.topics.join(' ')) };
    return { passage, paper, fields };
  });
  const stats = {};
  for (const field of Object.keys(FIELD_WEIGHTS)) {
    const df = new Map();
    for (const doc of docs) for (const token of new Set(doc.fields[field])) df.set(token, (df.get(token) || 0) + 1);
    stats[field] = { df, avg: docs.reduce((sum, doc) => sum + doc.fields[field].length, 0) / (docs.length || 1) || 1 };
  }
  return { docs, stats };
}

function bm25(index, query, doc) {
  let score = 0;
  for (const [field, boost] of Object.entries(FIELD_WEIGHTS)) {
    const { df, avg } = index.stats[field]; const tokens = doc.fields[field];
    for (const token of unique(query)) {
      const tf = tokens.reduce((n, word) => n + Number(word === token), 0);
      if (!tf) continue;
      const freq = df.get(token) || 0;
      const idf = Math.log(1 + (index.docs.length - freq + 0.5) / (freq + 0.5));
      score += boost * idf * tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * tokens.length / avg));
    }
  }
  return score;
}

const coverage = (query, document) => { const q = unique(query), d = new Set(document); return q.length ? q.filter(token => d.has(token)).length / q.length : 0; };
export function featureVector(question, doc, score) {
  const q = tokenize(question), qt = unique(q), pt = unique(doc.fields.text);
  const bigrams = tokens => tokens.slice(1).map((word, i) => `${tokens[i]} ${word}`);
  const union = new Set([...qt, ...pt]);
  return [Math.log1p(score), coverage(qt, pt), coverage(qt, doc.fields.title), coverage(bigrams(q), bigrams(doc.fields.text)), union.size ? qt.filter(word => pt.includes(word)).length / union.size : 0, pt.length / (pt.length + 40), coverage(qt.filter(word => /\p{N}/u.test(word)), pt), coverage(qt, doc.fields.tags)];
}

function validateModel(model, corpus, hash) {
  invariant(isRecord(model) && model.schema_version === 1 && model.algorithm === 'linear_logistic_v1', 'Incompatible learned model schema/algorithm.');
  invariant(nonempty(model.model_id) && model.feature_version === FEATURE_VERSION && JSON.stringify(model.feature_names) === JSON.stringify(FEATURE_NAMES), 'Incompatible learned model features.');
  invariant(Array.isArray(model.weights) && model.weights.length === FEATURE_NAMES.length && model.weights.every(Number.isFinite) && Number.isFinite(model.bias), 'Invalid learned model coefficients.');
  invariant(isRecord(model.transforms) && model.transforms.kind === 'identity' && model.transforms.feature_version === FEATURE_VERSION, 'Incompatible learned model transforms.');
  const provenance = model.training_provenance;
  invariant(model.synthetic === false && model.pilot === true && Number.isInteger(model.seed), 'Only explicitly declared, real-data pilot models are supported.');
  invariant(isRecord(provenance) && /^[0-9a-f]{64}$/.test(provenance.dataset_sha256) && provenance.corpus_sha256 === hash && provenance.corpus_version === corpus.corpus_version, 'Model dataset or corpus provenance is missing/incompatible.');
  invariant(provenance.train_rows > 0 && provenance.reviewed_train_rows === provenance.train_rows && provenance.leakage_checked === true && Array.isArray(provenance.annotators) && provenance.annotators.length > 0, 'Model requires reviewed training judgments and a leakage check.');
}

export function createEngine(inputCorpus, { model: inputModel = null } = {}) {
  // A caller cannot mutate a validated index or model after construction.
  const corpus = JSON.parse(JSON.stringify(inputCorpus)); validateCorpus(corpus);
  const hash = corpusHash(corpus), index = indexCorpus(corpus);
  const datasetExtracts = corpus.passages.some(passage => passage.text_kind === 'dataset_paragraph');
  const model = inputModel === null ? null : JSON.parse(JSON.stringify(inputModel));
  if (model !== null) validateModel(model, corpus, hash);
  const available_methods = [{ id: 'bm25', label: 'BM25 baseline', available: true, reason: null }, { id: 'learned', label: 'CPU-trained relevance ranker', available: model !== null, reason: model ? null : 'No reviewed-data trained model is installed. The lexical baseline is available.' }];
  function ask({ question, method = 'bm25', excluded_paper_ids = [], excluded_passage_ids = [], paper_id = null, top_k = 5, challenge_id = null } = {}) {
    const started = globalThis.performance?.now() ?? Date.now();
    invariant(typeof question === 'string' && question.trim().length > 0 && question.length <= 1200, 'Enter a nonempty question of at most 1,200 characters.');
    invariant(method === 'bm25' || method === 'learned', 'Unknown retrieval method.');
    invariant(method !== 'learned' || model !== null, 'Learned ranking is unavailable: no reviewed-data trained model is installed.');
    invariant(Array.isArray(excluded_paper_ids) && excluded_paper_ids.every(nonempty), 'Excluded paper IDs must be an array of nonempty IDs.');
    const known = new Set(corpus.papers.map(paper => paper.id));
    invariant(paper_id === null || known.has(paper_id), 'Unknown paper scope.');
    const passageIds = new Set(corpus.passages.map(passage => passage.id));
    invariant(Array.isArray(excluded_passage_ids) && excluded_passage_ids.every(id => passageIds.has(id)), 'Unknown excluded passage.');
    const removedPassages = new Set(excluded_passage_ids);
    for (const id of excluded_paper_ids) invariant(known.has(id), `Unknown excluded paper ID: ${id}.`);
    invariant(Number.isInteger(top_k) && top_k >= 1 && top_k <= 20, 'top_k must be an integer between 1 and 20.');
    invariant(challenge_id === null || typeof challenge_id === 'string', 'Invalid challenge ID.');
    const challenge = challenge_id === null ? null : corpus.challenges.find(item => item.id === challenge_id);
    invariant(challenge_id === null || challenge !== undefined, `Unknown challenge ID: ${challenge_id}.`);
    const activeChallenge = challenge && normalizeQuestion(challenge.question) === normalizeQuestion(question) ? challenge : null;
    const exclusions = unique(excluded_paper_ids).sort(cmp), excluded = new Set(exclusions), query = tokenize(question);
    // Index statistics stay frozen across stress runs; source filtering precedes candidate scoring and selection.
    const allowed = index.docs.filter(doc => !excluded.has(doc.paper.id) && !removedPassages.has(doc.passage.id) && (paper_id === null || doc.paper.id === paper_id));
    const candidates = allowed.map(doc => {
      const lexical = bm25(index, query, doc), features = featureVector(question, doc, lexical);
      const linear = model ? model.bias + features.reduce((sum, value, i) => sum + value * model.weights[i], 0) : 0;
      return { doc, lexical, features, score: method === 'learned' ? 1 / (1 + Math.exp(-Math.max(-700, Math.min(700, linear)))) : lexical };
    }).filter(item => item.lexical > 0).sort((a, b) => b.score - a.score || cmp(a.doc.passage.id, b.doc.passage.id));
    const selected = candidates.slice(0, top_k);
    // This is an uncalibrated lexical heuristic, never an answerability or truth probability.
    const meaningful = selected.filter(item => {
      const excerptOverlap = unique(query).filter(token => item.doc.fields.text.includes(token)).length;
      const combined = [...item.doc.fields.text, ...item.doc.fields.title];
      const combinedOverlap = unique(query).filter(token => combined.includes(token)).length;
      return excerptOverlap >= 1 && combinedOverlap >= Math.min(2, unique(query).length) && coverage(query, combined) >= 0.35;
    });
    const answerable = query.length > 0 && meaningful.length > 0;
    const evidence = selected.map(({ doc, score, lexical }) => {
      const { paper, passage } = doc;
      const relation = activeChallenge?.relations.find(item => item.passage_id === passage.id);
      return { passage_id: passage.id, paper_id: paper.id, title: paper.title, authors: [...paper.authors], year: paper.year, url: paper.url, source_url: passage.source_url, text: passage.text, section: passage.section, text_kind: passage.text_kind, text_sha256: sha256(passage.text), curator_note: passage.curator_note, used_in_brief: meaningful.includes(candidates.find(item => item.doc.passage.id === passage.id)), matched_text_terms: unique(query).filter(token => doc.fields.text.includes(token)), matched_title_terms: unique(query).filter(token => doc.fields.title.includes(token)), score, lexical_score: lexical, score_kind: method === 'learned' ? 'learned_relevance_not_confidence' : 'bm25_relevance', curated_relation: relation ? { relation: relation.relation, rationale: relation.rationale, review: { ...(activeChallenge.review || {}), independent_human_review: activeChallenge.review?.independent_human_review === true } } : null };
    });
    const meaningfulIds = new Set(meaningful.map(item => item.doc.passage.id));
    const claims = answerable ? evidence.filter(item => meaningfulIds.has(item.passage_id)).map(item => ({ text: item.text, passage_ids: [item.passage_id], kind: 'extractive' })) : [];
    const brief = answerable ? `Relevant indexed excerpts (${datasetExtracts ? 'QASPER-extracted dataset wording; not independently checked against current PDFs' : 'exact source wording'}; relevance is not verification):\n${claims.map(claim => `“${claim.text}” [${claim.passage_ids[0]}]`).join('\n')}` : 'I do not have enough relevant evidence in this indexed collection to produce an evidence brief. This does not establish that no evidence exists elsewhere.';
    const elapsed = (globalThis.performance?.now() ?? Date.now()) - started;
    return { schema_version: 1, question: question.trim(), method, corpus_version: corpus.corpus_version, corpus_sha256: hash, model_id: method === 'learned' ? model.model_id : null, feature_version: FEATURE_VERSION, response_mode: 'extractive', status: answerable ? 'evidence_found' : 'insufficient_evidence', brief, paper_id, excluded_passage_ids: [...removedPassages].sort(cmp), excluded_paper_ids: exclusions, challenge_id: activeChallenge?.id ?? null, evidence, claims, limitations: [datasetExtracts ? 'QASPER v0.3 known-paper paragraph collection: dataset-extracted text, not independently verified current-PDF wording or a complete literature review.' : 'Curated abstract/excerpt collection, not a complete literature review.', 'Relevance scores do not measure truth or entailment.', 'Evidence found means relevant excerpts passed a lexical heuristic; it does not mean the question was answered.', 'The insufficient-evidence gate is an uncalibrated lexical heuristic; it can miss paraphrases and accept related but unanswering excerpts.', ...(activeChallenge ? ['Curated relations apply only to this unchanged development challenge; they are not automatic scientific verification.'] : []), ...(method === 'learned' ? [datasetExtracts ? 'Exploratory logistic pilot trained on reused QASPER human-selected references and assumed negatives. Unselected paragraphs were not individually verified as irrelevant. Test annotations are partial; unlabeled test texts informed fixed IDF. The pilot underperformed BM25; no improvement or semantic verification is claimed.' : 'This relevance model is an exploratory pilot trained on reviewed judgments.'] : [])], diagnostics: { distinct_papers: new Set(evidence.map(item => item.paper_id)).size, candidate_count: candidates.length, allowed_passage_count: allowed.length, elapsed_ms: Math.max(0, elapsed), gate: 'heuristic_v1', gate_min_text_overlap: 1, gate_min_combined_overlap: Math.min(2, unique(query).length), gate_min_combined_coverage: 0.35, top_k, index_statistics: 'fixed_full_corpus' } };
  }
  return { available_methods, ask };
}

export function compareResults(original, stressed) {
  invariant(isRecord(original) && isRecord(stressed) && Array.isArray(original.evidence) && Array.isArray(stressed.evidence), 'Compare requires two engine results.');
  invariant(normalizeQuestion(original.question) === normalizeQuestion(stressed.question) && original.method === stressed.method && original.paper_id === stressed.paper_id && original.corpus_version === stressed.corpus_version && original.corpus_sha256 === stressed.corpus_sha256 && original.model_id === stressed.model_id && original.diagnostics?.top_k === stressed.diagnostics?.top_k, 'Compare requires the same question, corpus, model, method and top_k.');
  const before = new Set(original.evidence.map(item => item.passage_id)), after = new Set(stressed.evidence.map(item => item.passage_id));
  const originalPapers = new Set(original.evidence.map(item => item.paper_id)), stressedPapers = new Set(stressed.evidence.map(item => item.paper_id));
  const retained = [...before].filter(id => after.has(id)).sort(cmp), union = new Set([...before, ...after]);
  return { removed_paper_ids: [...originalPapers].filter(id => !stressedPapers.has(id)).sort(cmp), added_passage_ids: [...after].filter(id => !before.has(id)).sort(cmp), removed_passage_ids: [...before].filter(id => !after.has(id)).sort(cmp), retained_passage_ids: retained, passage_jaccard: union.size ? retained.length / union.size : 1, status_transition: `${original.status} -> ${stressed.status}` };
}
