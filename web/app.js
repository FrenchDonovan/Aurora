import { initializeStudy } from './ui/study.js?v=aurora-study-v1';
import { compareResults, corpusHash, FEATURE_VERSION } from './lib/engine.js?v=aurora-study-v1';
import { initializeEngine } from './ui/model-loader.js?v=aurora-study-v1';
import { initializeRLArena } from './ui/rl-arena.js?v=aurora-study-v1';

const $ = id => document.getElementById(id);
const state = { corpus: null, engine: null, evaluation: null, original: null, current: null, exclusions: new Set(), challenge: null, runs: 0, hash: null, modelHash: null, modelNote: '', sourceFocus: null };
const APP_VERSION = 'aurora-study-v1';
const normalized = value => value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
const scrollBehavior = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

// Every corpus field and user question is rendered as text, never as HTML.
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}
function action(text, className, callback) {
  const node = element('button', className, text);
  node.type = 'button'; node.addEventListener('click', callback); return node;
}
function setStatus(message) { $('app-status').textContent = message; }
function showError(message) { $('app-error').textContent = message; $('app-error').hidden = false; }
function clearError() { $('app-error').hidden = true; $('app-error').textContent = ''; }
function sourceLink(url, text, className = 'external-source') {
  const link = element('a', className, text);
  try { const parsed = new URL(url); if (parsed.protocol !== 'https:') throw new Error('Invalid source URL'); link.href = parsed.href; }
  catch { return element('span', className, 'Source link unavailable'); }
  link.target = '_blank'; link.rel = 'noopener noreferrer';
  link.setAttribute('aria-label', `${text} (opens external source in a new tab)`); return link;
}
function fact(label, value) {
  const node = element('span'); node.append(element('b', '', value), document.createTextNode(` ${label}`)); return node;
}
function challengeFor(question) {
  return state.corpus.challenges.find(item => item.id === state.challenge && normalized(item.question) === normalized(question)) || null;
}
function runNewQuestion(question) {
  if (!state.engine) return;
  clearError();
  try {
    const challenge = challengeFor(question);
    const result = state.engine.ask({ question, method: $('method').value, excluded_paper_ids: [], top_k: 5, challenge_id: challenge?.id ?? null });
    state.exclusions.clear(); state.original = result; state.current = result; state.runs += 1;
    renderResult();
    setStatus(`${result.status === 'evidence_found' ? 'Relevant evidence retrieved' : 'Evidence gap in this collection'}. ${result.evidence.length} excerpts selected. Retrieval does not establish that the question has been answered.`);
    $('result-title').focus({ preventScroll: true });
    if (window.matchMedia('(max-width: 760px)').matches) $('result').scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  } catch (error) { showError(error.message || 'The investigation could not run. Please try a shorter question.'); setStatus('The previous result, if any, is unchanged.'); }
}
function rerun(exclusions, focusId = 'result-title') {
  if (!state.original) return;
  clearError();
  try {
    const result = state.engine.ask({ question: state.original.question, method: state.original.method, excluded_paper_ids: [...exclusions].sort(), top_k: 5, challenge_id: state.original.challenge_id });
    state.exclusions = new Set(exclusions); state.current = result; state.runs += 1; renderResult();
    setStatus(`${exclusions.size} ${exclusions.size === 1 ? 'paper excluded' : 'papers excluded'}. The original question was rerun. ${result.evidence.length} excerpts remain selected.`);
    $(focusId)?.focus({ preventScroll: true });
  } catch (error) { showError(error.message || 'The evidence stress test could not run.'); }
}
function excludePaper(paperId) { const next = new Set(state.exclusions); next.add(paperId); rerun(next); }
function restorePaper(paperId) { const next = new Set(state.exclusions); next.delete(paperId); rerun(next); }

function renderResult() {
  const result = state.current; if (!result) return;
  $('empty-state').hidden = true; $('result').hidden = false;
  $('result-title').textContent = result.question;
  $('result-mode').textContent = result.status === 'evidence_found' ? 'EVIDENCE RETRIEVED · EXTRACTIVE EXCERPTS' : 'INSUFFICIENT EVIDENCE IN THIS COLLECTION';
  $('result-mode').classList.toggle('insufficient', result.status !== 'evidence_found');
  $('run-count').textContent = `Run ${String(state.runs).padStart(2, '0')} · live local retrieval`;
  renderBrief(result);
  const papers = new Set(result.evidence.map(item => item.paper_id));
  $('run-facts').replaceChildren(fact('brief-used excerpts', result.claims.length), fact('retrieval candidates', result.evidence.length), fact('distinct papers', papers.size), fact('response', result.response_mode), fact('method', result.method === 'bm25' ? 'BM25' : result.method));
  const challenge = state.corpus.challenges.find(item => item.id === result.challenge_id);
  $('challenge-note').hidden = !challenge;
  if (challenge) {
    const reviewRecord = result.evidence.find(item => item.curated_relation?.review)?.curated_relation.review ?? challenge.review;
    const review = reviewRecord?.independent_human_review === true ? 'Human-reviewed development example' : 'Curated development example · not independently human-adjudicated';
    $('challenge-note').replaceChildren(element('strong', '', review), element('p', '', `Claim under inspection: “${challenge.claim}”`));
    $('challenge-note').lastElementChild.style.margin = '5px 0 0';
    if (reviewRecord?.reviewer) $('challenge-note').append(element('span', '', ` Curation: ${reviewRecord.reviewer}${reviewRecord.date ? ` · ${reviewRecord.date}` : ''}.`));
  }
  $('evidence-count').textContent = `(${result.evidence.length})`;
  const added = state.exclusions.size ? new Set(compareResults(state.original, result).added_passage_ids) : new Set();
  $('evidence-list').replaceChildren(...result.evidence.map((item, index) => renderEvidence(item, index, added.has(item.passage_id))));
  if (!result.evidence.length) $('evidence-list').append(element('p', 'scope-note', 'No excerpts passed the collection’s relevance gate. Restore a source or try a different in-scope question. This does not mean that no evidence exists elsewhere.'));
  $('limitations-list').replaceChildren(...result.limitations.map(text => element('li', '', text)));
  const elapsed = result.diagnostics?.elapsed_ms;
  $('diagnostics').textContent = `Corpus ${result.corpus_version} · gate ${result.diagnostics?.gate ?? 'not specified'} · ${result.diagnostics?.candidate_count ?? 'unknown'} retrieval candidates${Number.isFinite(elapsed) ? ` · ${elapsed.toFixed(2)} ms engine-only timing for this run (not a benchmark)` : ''}.`;
  renderExclusions(); renderComparison();
}
function renderEvidence(item, index, added) {
  const article = element('article', `evidence-card${added ? ' new-evidence' : ''}`);
  article.id = `evidence-${index + 1}`; article.tabIndex = -1; article.dataset.passageId = item.passage_id; article.dataset.paperId = item.paper_id;
  const head = element('div', 'evidence-card-head');
  const citation = action(`[${index + 1}]`, 'citation-button', () => openSource(item.paper_id, citation));
  citation.setAttribute('aria-label', `Open source ${index + 1}: ${item.title}`);
  const titleBlock = element('div');
  const title = action(item.title, 'paper-title', () => openSource(item.paper_id, title));
  const authors = item.authors.length > 2 ? `${item.authors[0]} et al.` : item.authors.join(' & ');
  titleBlock.append(title, element('p', 'paper-meta', `${authors} · ${item.year}${added ? ' · newly selected after removal' : ''}`));
  head.append(citation, titleBlock);
  article.append(element('p', 'candidate-state', item.used_in_brief ? 'USED IN EXTRACTIVE BRIEF · lexical gate passed' : 'WEAK RETRIEVAL CANDIDATE · excluded from brief'));
  article.append(element('p', 'selection-basis', `Text matches: ${item.matched_text_terms.join(', ') || 'none'} · Title matches: ${item.matched_title_terms.join(', ') || 'none'}. This does not establish semantic support.`));
  article.append(head, element('p', 'quote-label', `EXACT EXCERPT · ${item.section}`), element('blockquote', '', item.text));
  if (item.curator_note) { const note = element('p', 'curator-note'); note.append(element('strong', '', 'Curator context · '), document.createTextNode(item.curator_note)); article.append(note); }
  if (item.curated_relation) {
    const relation = element('div', 'relation-note');
    const review = item.curated_relation.review ?? state.corpus.challenges.find(value => value.id === state.current.challenge_id)?.review;
    const isHuman = review?.independent_human_review === true;
    relation.append(element('strong', '', `${isHuman ? 'HUMAN-REVIEWED' : 'UNADJUDICATED DEVELOPMENT'} RELATION TO THE SAMPLE CLAIM: ${item.curated_relation.relation.toUpperCase()}`), element('span', '', item.curated_relation.rationale));
    if (review?.reviewer) relation.append(element('p', 'relation-review', `Curation: ${review.reviewer}${review.date ? ` · ${review.date}` : ''}. Independent human review: ${isHuman ? 'yes' : 'no'}.`));
    article.append(relation);
  }
  const footer = element('div', 'evidence-card-footer');
  const score = element('span', 'evidence-score');
  score.append(document.createTextNode(`${state.current.method === 'bm25' ? 'BM25' : 'Learned'} relevance `), element('b', '', Number.isFinite(item.score) ? item.score.toFixed(3) : 'unavailable'));
  score.title = 'Lexical retrieval relevance, not a confidence or support probability.';
  const remove = action('Exclude paper & rerun ↗', 'text-button exclude-button', () => excludePaper(item.paper_id));
  remove.setAttribute('aria-label', `Exclude ${item.title} and rerun the same question`);
  footer.append(score, remove); article.append(footer); return article;
}
function renderBrief(result) {
  const parts = result.brief.split(/\[([^\]]+)\]/g);
  $('brief').replaceChildren();
  parts.forEach((text, index) => {
    const evidenceIndex = index % 2 ? result.evidence.findIndex(item => item.passage_id === text) : -1;
    if (evidenceIndex >= 0) {
      const citation = action(`[${evidenceIndex + 1}]`, 'brief-citation', () => {
        const target = $(`evidence-${evidenceIndex + 1}`);
        target?.focus({ preventScroll: true }); target?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
      });
      citation.setAttribute('aria-label', `Inspect cited excerpt ${evidenceIndex + 1}`);
      $('brief').append(citation);
    } else $('brief').append(document.createTextNode(index % 2 ? `[${text}]` : text));
  });
}
function renderExclusions() {
  $('exclusions').hidden = !state.exclusions.size;
  $('excluded-list').replaceChildren(...[...state.exclusions].map(id => {
    const paper = state.corpus.papers.find(item => item.id === id);
    const li = element('li');
    const restore = action('Restore ↶', 'text-button', () => restorePaper(id));
    restore.setAttribute('aria-label', `Restore ${paper.title} and rerun`);
    li.append(element('span', '', paper.title), restore); return li;
  }));
}
function renderComparison() {
  $('comparison').hidden = !state.exclusions.size;
  if (!state.exclusions.size) return;
  const comparison = compareResults(state.original, state.current);
  const metrics = element('div', 'comparison-metrics');
  metrics.append(comparisonMetric(state.exclusions.size, 'papers excluded'), comparisonMetric(`${Math.round(comparison.passage_jaccard * 100)}%`, 'retrieved-passage overlap'), comparisonMetric(comparison.added_passage_ids.length, 'newly selected excerpts'));
  const before = state.original.status === 'evidence_found' ? 'Evidence retrieved' : 'Insufficient evidence';
  const after = state.current.status === 'evidence_found' ? 'evidence retrieved' : 'insufficient evidence';
  const description = element('p', 'comparison-description', `${before} → ${after}. ${comparison.retained_passage_ids.length} originally selected excerpts retained; ${comparison.removed_passage_ids.length} no longer selected. Method and question stay fixed.`);
  $('comparison-summary').replaceChildren(metrics, description);
  $('original-brief').textContent = state.original.brief;
  $('stressed-brief').textContent = state.current.brief;
}
function comparisonMetric(value, label) { const item = element('div'); item.append(element('b', '', value), element('span', '', label)); return item; }

function openSource(paperId, trigger) {
  const paper = state.corpus.papers.find(item => item.id === paperId); if (!paper) return;
  state.sourceFocus = trigger ?? document.activeElement;
  const content = $('source-dialog-content');
  const title = element('h2', 'dialog-title', paper.title); title.id = 'dialog-title';
  const note = element('p', 'dialog-note'); note.append(element('strong', '', 'Curator context · '), document.createTextNode(paper.curator_note));
  content.replaceChildren(title, element('p', 'dialog-authors', `${paper.authors.join(', ')} · ${paper.year}`), sourceLink(paper.url, 'Open original paper ↗'), note);
  for (const passage of state.corpus.passages.filter(item => item.paper_id === paperId)) {
    const excerpt = element('section', 'dialog-excerpt');
    excerpt.append(element('p', 'quote-label', `EXACT EXCERPT · ${passage.section}`), element('blockquote', '', passage.text), element('p', 'curator-note', passage.curator_note), sourceLink(passage.source_url, 'Inspect excerpt source ↗'));
    content.append(excerpt);
  }
  const metadata = element('dl', 'dialog-metadata');
  const license = paper.license.status === 'verified' ? `${paper.license.id ?? 'Verified license'} (see source)` : 'Third-party reuse permission not established';
  for (const [label, value] of [['Paper version', paper.version ?? 'Not specified'], ['Accessed', paper.accessed_at ?? 'Not specified'], ['License record', license], ['Source ID', paper.id], ['Corpus version', state.corpus.corpus_version]]) metadata.append(element('dt', '', label), element('dd', '', value));
  content.append(metadata, element('p', 'dialog-scope', 'The library contains a short excerpt, not the complete paper. External source links open in a new tab. Curator context is original commentary, not source wording.'));
  $('source-dialog').showModal();
}
function closeSource() { $('source-dialog').close(); state.sourceFocus?.focus({ preventScroll: true }); }

function renderSourceField() {
  $('source-field').replaceChildren(...state.corpus.papers.map((paper, index) => {
    const shortTitle = paper.title.split(':')[0];
    const button = action('', 'source-ticket', () => openSource(paper.id, button));
    button.append(element('span', 'source-ticket-number', String(index + 1).padStart(2, '0')), element('strong', '', shortTitle), element('span', 'source-ticket-year', paper.year), element('span', 'source-ticket-arrow', '↗'));
    button.setAttribute('aria-label', `Inspect source ${index + 1}: ${paper.title}`);
    return button;
  }));
}

function renderLibrary() {
  if (!state.corpus) return;
  const query = $('source-search').value.trim().toLowerCase();
  const papers = state.corpus.papers.filter(paper => `${paper.title} ${paper.authors.join(' ')} ${paper.topics.join(' ')}`.toLowerCase().includes(query));
  $('source-count').textContent = `${papers.length} of ${state.corpus.papers.length} papers${query ? ' match this filter' : ' in this collection'}.`;
  $('source-library').replaceChildren(...papers.map((paper, index) => {
    const article = element('article', 'library-paper');
    const body = element('div');
    body.append(element('h2', '', paper.title), element('p', 'paper-meta', `${paper.authors[0]}${paper.authors.length > 1 ? ' et al.' : ''} · ${paper.year} · ${paper.version ?? 'version unspecified'}`), element('p', '', paper.curator_note));
    const topics = element('div', 'topics'); topics.append(...paper.topics.map(topic => element('span', 'topic', topic))); body.append(topics);
    const inspect = action('Inspect source ↗', 'text-button', () => openSource(paper.id, inspect));
    article.append(element('span', 'paper-number', String(index + 1).padStart(2, '0')), body, inspect); return article;
  }));
  if (!papers.length) $('source-library').append(element('p', 'no-matches', 'No matching papers in this collection.'));
}
function changeView(view) {
  if (!['study', 'lab', 'rl', 'corpus', 'methods'].includes(view)) return;
  if (window.location.hash !== `#${view}`) window.history.pushState(null, '', `#${view}`);
  for (const name of ['study', 'lab', 'rl', 'corpus', 'methods']) $(`view-${name}`).hidden = name !== view;
  document.querySelectorAll('.main-nav [data-view]').forEach(button => {
    if (button.dataset.view === view) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  const heading = $(({study:'study-title',lab:'lab-title', rl:'rl-title', corpus:'corpus-title', methods:'methods-title'})[view]);
  heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true });
  if (view === 'study') initializeStudy();
  window.scrollTo({ top: 0, behavior: 'auto' });
}
function renderEvaluation() {
  const evaluation = state.evaluation;
  const notRun = !evaluation || evaluation.status === 'not_run';
  $('evaluation-title').textContent = notRun ? 'Seed demo: not evaluated.' : evaluation.status === 'pilot' ? 'Exploratory pilot · not confirmatory.' : 'Recorded evaluation results.';
  $('evaluation-note').textContent = evaluation?.note ?? 'The evaluation artifact could not be loaded. Open the QASPER study for its separate recorded pilot.';
  const details = $('evaluation-details');
  details.replaceChildren(element('strong', '', notRun ? 'Separate QASPER study is now available.' : `Artifact status: ${evaluation.status}`), element('p', '', notRun ? 'This eight-excerpt seed collection has no held-out evaluation. Open the Study tab for real-data model results and negative findings on a separate known-paper QASPER task. No trained-model improvement is claimed. Engineering tests check behavior; they do not measure research quality.' : 'These are recorded offline measurements, not measurements of the current visitor’s question. Consult the run provenance before interpreting them.'));
  if (!notRun && evaluation.metrics?.length) {
    const list = element('ul');
    for (const metric of evaluation.metrics) if (typeof metric.value === 'number') list.append(element('li', '', `${metric.label ?? metric.name ?? metric.id}: ${metric.value}${metric.unit ? ` ${metric.unit}` : ''}`));
    details.append(list);
  }
}

function receipt() {
  const result = state.current;
  if (!result) throw new Error('Run an investigation before exporting.');
  // Export the active evidence only: the original pre-exclusion brief is intentionally omitted.
  return {
    receipt_schema_version: 1, app_version: APP_VERSION, exported_at: new Date().toISOString(),
    corpus_sha256: state.hash, corpus_hash_serialization: 'JSON recursively sorted object keys; array order preserved; UTF-8',
    feature_version: FEATURE_VERSION, model_sha256: result.method === 'learned' ? state.modelHash : null,
    privacy: 'Query processed locally; this download explicitly persists the query.',
    score_interpretation: 'Lexical relevance, not truth confidence or semantic support.',
    timing_type: 'Browser engine-only wall time for one run; not a benchmark.',
    configuration: { top_k: 5, response_mode: 'extractive' },
    result: structuredClone(result),
    sensitivity: state.exclusions.size ? compareResults(state.original, result) : null,
    development_example: result.challenge_id ? {
      id: result.challenge_id,
      review: structuredClone(result.evidence.find(item => item.curated_relation?.review)?.curated_relation.review ?? state.corpus.challenges.find(item => item.id === result.challenge_id)?.review ?? { independent_human_review: false, reviewer: 'not recorded' }),
      independent_human_review: (result.evidence.find(item => item.curated_relation?.review)?.curated_relation.review ?? state.corpus.challenges.find(item => item.id === result.challenge_id)?.review)?.independent_human_review === true,
      note: 'Development example, not held-out evaluation. Without independent human review, relations remain unadjudicated.'
    } : null
  };
}
function markdownReceipt(value) {
  const result = value.result;
  const lines = ['# Aurora — evidence investigation', '', `**Question:** ${result.question}`, '', `**Mode:** ${result.response_mode} · **Method:** ${result.method} · **Status:** ${result.status}`, '', result.brief, '', '## Active source excerpts', ''];
  for (const [index, item] of result.evidence.entries()) {
    lines.push(`### [${index + 1}] ${item.title}`, '', `${item.authors.join(', ')} · ${item.year}`, '', `Source: ${item.url}`, '', `Exact excerpt (${item.section}):`, '', ...item.text.split('\n').map(line => `> ${line}`), '', `Curator context (original commentary): ${item.curator_note}`, '', `Relevance score: ${item.score} (${item.score_kind}). This is not truth confidence or semantic support.`, '');
    if (item.curated_relation) {
      const review = item.curated_relation.review ?? value.development_example?.review;
      lines.push(`Development-only curated relation: ${item.curated_relation.relation}. ${item.curated_relation.rationale}`, '', `Independent human review: ${review?.independent_human_review === true ? 'yes' : 'NO — unadjudicated development relation'}. Curator: ${review?.reviewer ?? 'not recorded'}. Review date: ${review?.date ?? 'not recorded'}.`, '');
    }
  }
  lines.push('## Provenance', '', `- App: ${value.app_version}`, `- Corpus: ${result.corpus_version}`, `- Corpus SHA-256: ${value.corpus_sha256}`, `- Features: ${value.feature_version}`, `- Model: ${result.model_id ?? 'none; lexical baseline'}`, `- Excluded paper IDs: ${result.excluded_paper_ids.join(', ') || 'none'}`, `- Active passage IDs: ${result.evidence.map(item => item.passage_id).join(', ') || 'none'}`, `- Exported: ${value.exported_at}`, '- Timing: browser engine-only; not a benchmark', '- Query processed locally; the explicit export persists it.', '');
  if (value.sensitivity) lines.push('## Evidence sensitivity', '', `Retrieved-passage overlap: ${value.sensitivity.passage_jaccard}. Status transition: ${value.sensitivity.status_transition}.`, '', 'The original pre-exclusion brief is omitted from this active-run receipt. Sensitivity is not causal attribution.', '');
  if (value.model_sha256) lines.push(`Installed model SHA-256 (sorted-key canonical JSON): ${value.model_sha256}`, '');
  if (value.development_example) lines.push(`Development example; independently human reviewed: ${value.development_example.independent_human_review}. ${value.development_example.independent_human_review ? '' : 'UNADJUDICATED; not independently human-reviewed.'} Not held-out evaluation.`, `Review provenance: ${JSON.stringify(value.development_example.review)}`, '');
  lines.push('## Limitations', '', ...result.limitations.map(text => `- ${text}`), '');
  return lines.join('\n');
}
function download(format) {
  clearError();
  try {
    const value = receipt();
    const text = format === 'json' ? JSON.stringify(value, null, 2) : markdownReceipt(value);
    const blob = new Blob([text], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url;
    link.download = `aurora-investigation-${new Date().toISOString().replace(/[:.]/g, '-')}.${format === 'json' ? 'json' : 'md'}`;
    document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(`${format === 'json' ? 'JSON' : 'Markdown'} receipt downloaded for the active run. It includes your question and selected evidence.`);
  } catch (error) { showError(`Export failed: ${error.message}`); }
}

async function loadJSON(path) { const response = await fetch(path); if (!response.ok) throw new Error(`Resource unavailable (${response.status})`); return response.json(); }
async function initialize() {
  try {
    const [corpus, evaluation, runtime] = await Promise.allSettled([loadJSON('./data/corpus.json'), loadJSON('./data/evaluation.json'), loadJSON('./data/runtime.json')]);
    if (corpus.status !== 'fulfilled') throw new Error('The source collection could not be loaded. Refresh the page or try again later.');
    state.corpus = corpus.value; state.hash = corpusHash(corpus.value);
    const validRuntime = runtime.status === 'fulfilled' && runtime.value?.schema_version === 1;
    const modelURL = validRuntime ? runtime.value.model?.url ?? null : null;
    const modelState = await initializeEngine(corpus.value, {modelURL});
    if (!validRuntime) modelState.note = 'Learned-mode configuration is unavailable. The BM25 baseline remains usable.';
    state.engine = modelState.engine; state.modelHash = modelState.modelHash; state.modelNote = modelState.note;
    state.evaluation = evaluation.status === 'fulfilled' ? evaluation.value : null;
    $('method-note').textContent = state.modelNote;
    $('method').replaceChildren(...state.engine.available_methods.map(method => { const option = element('option', '', `${method.label}${method.available ? '' : ' · unavailable'}`); option.value = method.id; option.disabled = !method.available; if (method.reason) option.title = method.reason; return option; }));
    $('method').value = 'bm25';
    $('corpus-badge').textContent = `${state.corpus.papers.length} papers · ${state.corpus.passages.length} short excerpts`;
    $('samples').replaceChildren(...state.corpus.challenges.slice(0, 3).map((challenge, index) => {
      const button = action('', 'sample-button', () => { state.challenge = challenge.id; $('question').value = challenge.question; runNewQuestion(challenge.question); });
      button.append(element('span', '', String(index + 1).padStart(2, '0')), element('span', '', challenge.question), element('span', '', '↗')); return button;
    }));
    $('corpus-summary').textContent = `${state.corpus.papers.length} papers · ${state.corpus.passages.length} excerpts · ${state.corpus.domain}. Corpus ${state.corpus.corpus_version}. ${state.corpus.provenance_note ?? ''}`;
    initializeRLArena(state.corpus, { getInvestigation: () => state.current, inspectSource: openSource });
    changeView(window.location.hash.slice(1) || 'study');
    renderLibrary(); renderSourceField(); renderEvaluation(); $('ask-button').disabled = false; setStatus('Ready. Choose an example or investigate your own question.');
  } catch (error) { showError(error.message || 'The lab could not initialize. Please refresh the page.'); setStatus('The lab is unavailable. No result has been generated.'); $('evaluation-note').textContent = 'Application data could not be loaded. No research performance is claimed.'; }
}

$('question-form').addEventListener('submit', event => { event.preventDefault(); runNewQuestion($('question').value); });
$('question').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (state.engine) $('question-form').requestSubmit(); } });
$('question').addEventListener('input', () => { if (state.challenge && !challengeFor($('question').value)) state.challenge = null; if (state.current && normalized($('question').value) !== normalized(state.current.question)) setStatus('Question edited. Press Investigate to start a new run. The evidence below still belongs to the displayed previous question.'); });
$('reset-exclusions').addEventListener('click', () => rerun(new Set()));
$('reset-investigation').addEventListener('click', () => {
  state.original = null; state.current = null; state.exclusions.clear(); state.challenge = null;
  $('question').value = ''; $('result').hidden = true; $('exclusions').hidden = true; $('empty-state').hidden = false;
  clearError(); setStatus('Investigation reset. Choose an example or ask a new question.'); $('question').focus();
});
$('close-dialog').addEventListener('click', closeSource);
$('source-dialog').addEventListener('click', event => { if (event.target === $('source-dialog')) { const rect = $('source-dialog').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeSource(); } });
$('source-dialog').addEventListener('close', () => state.sourceFocus?.focus({ preventScroll: true }));
$('source-search').addEventListener('input', renderLibrary);
$('export-json').addEventListener('click', () => download('json'));
$('export-markdown').addEventListener('click', () => download('markdown'));
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => changeView(button.dataset.view)));
window.addEventListener('hashchange', () => changeView(window.location.hash.slice(1) || 'study')); 
initialize();
