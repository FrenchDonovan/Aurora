import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const source = path.join(root, 'web');
const output = path.join(root, 'dist');
if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Invalid build destination');
const required = ['index.html', 'styles.css', 'app.js', 'lib/engine.js', 'data/corpus.json', 'data/evaluation.json'];
for (const name of required) if (!existsSync(path.join(source, name))) throw new Error(`Missing required web asset: ${name}`);
const allowed = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt', '.ico', '.png', '.webp']);
const collected = [];
function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (lstatSync(target).isSymbolicLink()) throw new Error('Web assets must not contain symlinks');
    if (entry.isDirectory()) {
      if (['private', 'legacy', 'node_modules', '.git', 'fixtures'].includes(entry.name)) throw new Error(`Forbidden production directory: ${entry.name}`);
      inspect(target);
    } else {
      if (!allowed.has(path.extname(entry.name))) throw new Error(`Unsupported web asset: ${entry.name}`);
      const publicStudyCorpus = path.relative(source, target).replaceAll('\\','/') === 'data/study/corpus.json';
      if (statSync(target).size > (publicStudyCorpus ? 8_000_000 : 2_000_000)) throw new Error(`Asset too large: ${entry.name}`);
      if (['.js', '.json', '.html', '.css', '.svg', '.txt'].includes(path.extname(entry.name))) {
        const text = readFileSync(target, 'utf8');
        if (/"split"\s*:\s*"test"/.test(text) || /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) throw new Error(`Private/test material found in ${entry.name}`);
      }
      collected.push(path.relative(source, target));
    }
  }
}
inspect(source);
const corpus = JSON.parse(readFileSync(path.join(source, 'data/corpus.json'), 'utf8'));
if (corpus.schema_version !== 1 || !corpus.papers?.length || !corpus.passages?.length) throw new Error('Corpus is missing or invalid');
const evaluation = JSON.parse(readFileSync(path.join(source, 'data/evaluation.json'), 'utf8'));
if (!['not_run', 'pilot', 'validated'].includes(evaluation.status)) throw new Error('Unknown evaluation status');
const modelPath = path.join(source, 'data/model.json');
if (existsSync(modelPath)) {
  const model = JSON.parse(readFileSync(modelPath, 'utf8'));
  if (model.synthetic || !model.training_provenance) throw new Error('A public learned model must have non-synthetic training provenance');
}
if (existsSync(output) && lstatSync(output).isSymbolicLink()) throw new Error('Refusing linked build destination');
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(source, output, { recursive: true });
// Declare optional assets explicitly: some static hosts serve index.html for missing JSON.
writeFileSync(path.join(output, 'data/runtime.json'), JSON.stringify({schema_version:1, model:existsSync(modelPath) ? {url:'./data/model.json'} : null}) + '\n');
console.log(JSON.stringify({ output: 'dist', files: collected.length, bytes: collected.reduce((sum, name) => sum + statSync(path.join(source, name)).size, 0), corpus: corpus.corpus_version, evaluation: evaluation.status }));
