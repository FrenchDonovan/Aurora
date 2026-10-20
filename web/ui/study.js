import { createEngine, sha256 } from '../lib/engine.js?v=aurora-ranker-v2';
const $ = id => document.getElementById(id.replace(/^study-/,'history-'));
const node = (tag,text,cls) => {const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;};
const button = (label,fn) => {const b=node('button',label,'text-button');b.type='button';b.addEventListener('click',fn);return b;};
const pct = n => `${(n*100).toFixed(1)}%`;
const norm = s => s.normalize('NFKC').trim().replace(/\s+/gu,' ').toLowerCase();
let pending;
export function initializeHistoricalStudy() {
  if(pending)return pending;
  pending=load().catch(error=>{$('study-status').textContent=`Study unavailable: ${error.message}. Reload to retry; no results have been generated.`;});
  return pending;
}
async function load() {
  const hashes={};
  const fetchJSON=async name=>{const r=await fetch(`./data/study/${name}.json?v=aurora-ranker-v2`);if(!r.ok)throw Error(`Could not load ${name}`);const text=await r.text();hashes[name]=sha256(text.trimEnd());return JSON.parse(text);};
  const [corpus,model,report,predictions,audit]=await Promise.all(['corpus','model','report','predictions','rl-audit'].map(fetchJSON));
  if(hashes.corpus!==report.manifest.corpus_sha256 || hashes.model!==report.freeze.model_sha256 || hashes.predictions!==report.predictions_sha256)throw Error('Study fingerprint mismatch');
  const engine=createEngine(corpus,{model});
  const byID=new Map(corpus.passages.map(p=>[p.id,p]));
  let result=null,active=null,removed=new Set();
  const metrics=report.test.paper_macro_metrics;
  $('study-verdict').textContent=`On ${report.test.eligible_queries} eligible questions from ${report.test.eligible_papers} test papers, learned nDCG@5 was ${metrics.learned.ndcg_at_k.toFixed(3)}, versus BM25 ${metrics.bm25.ndcg_at_k.toFixed(3)}. No improvement is claimed. BM25 remains the default. The fixed learner penalized BM25 score and paragraph length; low training loss did not imply good ranking.`;
  const table=node('table');table.append(node('caption','Held-out paper-macro metrics · k = 5 · higher is better'));
  const header=node('tr');for(const t of ['Method','nDCG','MRR','Recall']){const th=node('th',t);th.scope='col';header.append(th);}table.append(header);
  for(const [method,label] of [['bm25','BM25'],['coverage','Token coverage'],['learned','Logistic ranker']]){const tr=node('tr');tr.append(node('th',label));for(const key of ['ndcg_at_k','mrr_at_k','recall_at_k'])tr.append(node('td',metrics[method][key].toFixed(3)));table.append(tr);}
  const ci=report.test.paired_learned_minus_bm25_95pct_bootstrap.ndcg_at_k;
  $('study-metrics').replaceChildren(table,node('p',`Learned − BM25 nDCG: ${ci.mean.toFixed(3)}; paired 95% paper-bootstrap interval [${ci.low.toFixed(3)}, ${ci.high.toFixed(3)}], 1,000 resamples. This is a small fixed-subset pilot.`));
  $('study-fingerprints').textContent=`Corpus SHA-256\n${report.manifest.corpus_sha256}\nModel SHA-256\n${report.freeze.model_sha256}\nProtocol SHA-256\n${report.freeze.protocol_sha256}\nPredictions SHA-256\n${report.predictions_sha256}`;
  for(const paper of [...corpus.papers].sort((a,b)=>a.title.localeCompare(b.title))){const opt=node('option',`${paper.title} [${paper.dataset_partition}]`);opt.value=paper.id;$('study-paper').append(opt);}
  function examples(queryID=null) {
    const eligible=predictions.filter(q=>q.paper_id===$('study-paper').value);
    const custom=node('option','Custom question · no reference labels');custom.value='';
    $('study-example').replaceChildren(custom,...eligible.map(q=>{const opt=node('option',`${q.partition}: ${q.question}`);opt.value=q.query_id;return opt;}));
    $('study-example').value=queryID??eligible[0]?.query_id??'';
    selectExample();
  }
  function selectExample(){const q=predictions.find(q=>q.query_id===$('study-example').value);$('study-question').value=q?.question??'';removed.clear();result=null;active=null;$('study-remove-references').disabled=true;$('study-control').disabled=true;$('study-export').disabled=true;$('study-result-title').textContent='Question selected · awaiting a new run';$('study-paragraphs').replaceChildren();$('study-run-summary').textContent='Run this question to inspect the current method. Previous exclusions were cleared.';$('study-removed').textContent='';}
  function run(){
    active=predictions.find(q=>q.paper_id===$('study-paper').value && norm(q.question)===norm($('study-question').value))??null;
    try{
      result=engine.ask({question:$('study-question').value,paper_id:$('study-paper').value,method:$('study-method').value,excluded_passage_ids:[...removed],top_k:5});
      const refs=new Set(active?.reference_ids??[]);
      $('study-result-title').textContent=result.question;
      $('study-run-summary').textContent=`${result.method==='bm25'?'BM25':'Experimental logistic'} · ${result.evidence.length} ranked candidates from ${result.diagnostics.allowed_passage_count} allowed paragraphs. ${active?`Reference recall@5: ${pct(result.evidence.filter(p=>refs.has(p.passage_id)).length/refs.size)} against partial QASPER annotations. These annotations are displayed after retrieval, never used as ranking features.`:'Custom question: no human reference score is available.'} ${result.status==='insufficient_evidence'?'The lexical brief gate found insufficient evidence. Candidates can still be weak or irrelevant.':'The lexical brief gate is uncalibrated; it does not verify an answer.'}`;
      $('study-removed').textContent=`${removed.size} paragraphs excluded before retrieval. Frozen full-collection IDF. ${removed.size?'Use Restore all to undo.':''}`;
      $('study-remove-references').disabled=!active;$('study-control').disabled=!active;
      $('study-export').disabled=false;
      $('study-paragraphs').replaceChildren(...result.evidence.map((item,i)=>{
        const card=node('article',undefined,'study-paragraph');card.dataset.passageId=item.passage_id;
        card.append(node('p',`${String(i+1).padStart(2,'0')} / ${item.section} · ${item.used_in_brief?'LEXICAL BRIEF GATE PASSED':'WEAK CANDIDATE · NOT USED IN BRIEF'}`,'candidate-state'));
        if(active)card.append(node('p',refs.has(item.passage_id)?'Selected as evidence by a QASPER human respondent':'Not selected in the available partial annotations','reference-state'));
        const details=node('details');details.open=i===0;details.append(node('summary',`Read dataset paragraph · ${item.text.length} characters`),node('blockquote',item.text));
        card.append(details,node('p',`Text matches: ${item.matched_text_terms.join(', ')||'none'}. Title matches: ${item.matched_title_terms.join(', ')||'none'}. Score ${item.score.toFixed(4)} is relevance, not confidence.`));
        const link=node('a','Original paper ↗');link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';
        card.append(link,button('Exclude paragraph & rerun',()=>{removed.add(item.passage_id);run();}),node('p',`Paragraph ${item.passage_id} · QASPER v0.3 · CC BY 4.0 · text SHA-256 ${item.text_sha256}`,'study-hash'));
        return card;
      }));
      if(!result.evidence.length)$('study-paragraphs').append(node('p','No positive-BM25 candidates remain. Restore paragraphs or change the question.'));
      $('study-status').textContent='Replay complete. All ranking runs locally in this browser.';
    }catch(error){$('study-status').textContent=error.message;}
  }
  function replay(query){$('study-paper').value=query.paper_id;examples(query.query_id);run();$('study-result-title').focus({preventScroll:true});$('study-form').scrollIntoView({block:'start',behavior:'auto'});}
  $('study-paper').addEventListener('change',()=>examples());$('study-example').addEventListener('change',selectExample);
  $('study-question').addEventListener('input',()=>{active=null;result=null;$('study-remove-references').disabled=true;$('study-control').disabled=true;$('study-export').disabled=true;$('study-status').textContent='Question edited. Click Rank paragraphs to replace the displayed previous result. Reference actions and export are disabled until that run.';});
  $('study-method').addEventListener('change',()=>{$('study-status').textContent='Method changed. Click Rank paragraphs to run it; the displayed result still uses its recorded method.';});
  $('study-form').addEventListener('submit',event=>{event.preventDefault();removed.clear();run();});
  $('study-remove-references').addEventListener('click',()=>{if(active){removed=new Set(active.reference_ids);run();}});
  $('study-control').addEventListener('click',()=>{if(active){removed=new Set(active.removal.matched_control.removed_ids);run();}});
  $('study-restore').addEventListener('click',()=>{removed.clear();run();});
  $('study-export').addEventListener('click',()=>{
    if(!result){$('study-status').textContent='Run a question before exporting.';return;}
    const value={schema_version:1,task:report.task,protocol_sha256:report.freeze.protocol_sha256,model_sha256:result.method==='learned'?report.freeze.model_sha256:null,result,reference_ids:active?.reference_ids??null,reference_provenance:active?'QASPER original human annotation union; partial, not new Aurora review':null,limitations:report.limitations};
    const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=node('a');a.href=url;a.download='aurora-qasper-replay.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);$('study-status').textContent='Active replay receipt downloaded.';
  });
  const heldout=predictions.filter(q=>q.partition==='test');
  function atlas(mode){
    const delta=q=>q.metrics.learned.ndcg_at_k-q.metrics.bm25.ndcg_at_k;
    const qs=heldout.filter(q=>mode!=='misses'||q.metrics.bm25.recall_at_k===0).sort((a,b)=>(mode==='gains'?delta(b)-delta(a):delta(a)-delta(b))||a.query_id.localeCompare(b.query_id));
    $('study-atlas').replaceChildren(...qs.slice(0,10).map(q=>{const row=node('article',undefined,'atlas-row');row.append(button(q.question,()=>replay(q)),node('p',`BM25 nDCG ${q.metrics.bm25.ndcg_at_k.toFixed(3)} → learned ${q.metrics.learned.ndcg_at_k.toFixed(3)} · Δ ${delta(q).toFixed(3)} · reference removal retains ${pct(q.removal.reference_removal.top5_retention)} of the learned top five; matched control ${pct(q.removal.matched_control.top5_retention)}.`));return row;}));
  }
  for(const mode of ['losses','gains','misses'])$(`study-${mode}`).addEventListener('click',()=>atlas(mode));atlas('losses');
  const ag=audit.aggregate;
  $('study-rl').textContent=`${audit.question_environments} real question environments × ${audit.seeds.length} seeds = ${ag.total_runs} runs, 3,000 episodes each. ${ag.optimal_runs} reached the exact lexical optimum; ${ag.strictly_better_than_greedy} beat greedy on that proxy, ${ag.worse_than_greedy} lost. Mean human-reference recall was ${pct(ag.mean_policy_reference_recall)} (greedy ${pct(ag.mean_greedy_reference_recall)}). Reaching the proxy optimum left most reference evidence unselected.`;
  const rt=node('table');const rh=node('tr');for(const text of ['Query / seed','Return','Regret','Reference recall'])rh.append(node('th',text));rt.append(rh);
  for(const r of audit.runs){const tr=node('tr');for(const text of [`${r.query_id.slice(0,8)} / ${r.seed}`,r.return.toFixed(3),r.regret.toFixed(3),pct(r.policy_reference_recall)])tr.append(node('td',text));rt.append(tr);}$('study-rl-table').append(rt);
  $('study-content').hidden=false;$('study-status').textContent=`Loaded ${corpus.papers.length} papers and ${corpus.passages.length.toLocaleString()} paragraphs. Dataset and model fingerprints verified.`;
  const first=heldout.slice().sort((a,b)=>a.query_id.localeCompare(b.query_id))[0];$('study-paper').value=first.paper_id;examples(first.query_id);run();
}
