import { createEngine, corpusHash } from '../lib/engine.js?v=aurora-ranker-v2';

// An optional model failure cannot disable the independent lexical baseline.
// Dependency injection lets the loader be tested without manufacturing a production model.
export async function initializeEngine(corpus, { fetchImpl = fetch, engineFactory = createEngine, hashModel = corpusHash, modelURL = './data/model.json' } = {}) {
  const baseline = engineFactory(corpus);
  const absent = { engine: baseline, modelHash: null, note: 'No reviewed-data model is installed. The BM25 baseline is available; learned mode is unavailable.' };
  if (modelURL === null) return absent;
  try {
    if (modelURL !== './data/model.json') throw new Error('Unsupported model location.');
    const response = await fetchImpl(modelURL);
    if (response.status === 404) return absent;
    if (!response.ok) throw new Error(`Optional model resource unavailable (${response.status}).`);
    const model = await response.json();
    if (model === null) throw new Error('The installed model artifact is empty.');
    const engine = engineFactory(corpus, { model });
    const modelHash = hashModel(model);
    return { engine, modelHash, note: 'Reviewed-data pilot ranker installed. Choose it explicitly to compare; baseline remains the default. Relevance is not semantic support.' };
  } catch (error) {
    return { engine: baseline, modelHash: null, note: 'Learned mode unavailable: the optional artifact could not be loaded or was rejected. The BM25 baseline remains usable.' };
  }
}
