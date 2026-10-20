import {createTreeEngine,TREE_FEATURE_VERSION} from '../lib/tree-ranker.js?v=aurora-ranker-v2';
import {sha256} from '../lib/engine.js?v=aurora-ranker-v2';
const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;};
const button=(label,callback)=>{const n=el('button',label,'text-button');n.type='button';n.addEventListener('click',callback);return n;};
const pct=x=>`${(x*100).toFixed(1)}%`;
const norm=s=>s.normalize('NFKC').trim().replace(/\s+/gu,' ').toLowerCase();
let pending;
export function initializeStudy(){if(!pending)pending=load().catch(error=>{$('study-status').textContent=`Study unavailable: ${error.message}. Reload to retry. No result has been generated.`;});return pending;}
async function load(){
  const hashes={};const get=async name=>{const response=await fetch(`./data/study-v2/${name}.json?v=aurora-ranker-v2`);if(!response.ok)throw Error(`Could not load ${name}`);const text=await response.text();hashes[name]=sha256(text.trimEnd());return JSON.parse(text);};
  const [release,corpus,statistics,model,report,predictions,development]=await Promise.all(['release','corpus','statistics','model','report','predictions','development-replays'].map(get));
  for(const [name,hash] of Object.entries(release.files))if(hashes[name]!==hash)throw Error(`Fingerprint mismatch: ${name}`);
  if(hashes.model!==report.freeze.model_sha256||hashes.statistics!==report.freeze.statistics_sha256||hashes.corpus!==report.manifest.public_corpus_sha256||hashes.predictions!==report.predictions_sha256)throw Error('Frozen artifact fingerprint mismatch');
  const engine=createTreeEngine(corpus,{model,statistics,statisticsHash:hashes.statistics});
  const queries=[...predictions,...development];const baseline=report.test.primary_baseline,metrics=report.test.paper_macro_metrics,delta=report.test.paired_learned_minus_bm25_95pct_bootstrap.ndcg_at_k;
  const improved=delta.mean>0,relative=(metrics.learned.ndcg_at_k/metrics[baseline].ndcg_at_k-1)*100;
  $('study-outcome-heading').textContent=improved?'Learned ranking.\nMeasured improvement.':'Keep the stronger baseline.';
  $('study-verdict').textContent=`On ${report.test.eligible_queries} eligible questions from ${report.test.eligible_papers} fresh papers, learned nDCG@5 was ${metrics.learned.ndcg_at_k.toFixed(3)}, versus primary BM25 ${metrics[baseline].ndcg_at_k.toFixed(3)}. ${improved?`${relative.toFixed(1)}% relative improvement in this pilot; learned is the default.`:'No held-out improvement; BM25 remains default.'} This measures partial-reference retrieval, not answer accuracy.`;
  const table=el('table');table.append(el('caption','Fresh-test paper-macro metrics · k=5 · higher is better'));const head=el('tr');for(const label of ['Method','nDCG','MRR','Recall']){const th=el('th',label);th.scope='col';head.append(th);}table.append(head);
  for(const [key,label]of [['global_bm25','BM25 · global'],['local_bm25','BM25 · local'],['coverage','Token coverage'],['learned','LambdaRank']]){const row=el('tr');row.append(el('th',label));for(const metric of ['ndcg_at_k','mrr_at_k','recall_at_k'])row.append(el('td',metrics[key][metric].toFixed(3)));table.append(row);}
  $('study-metrics').replaceChildren(table,el('p',`Learned − frozen primary BM25 nDCG: +${delta.mean.toFixed(3)}; paired 95% paper-bootstrap interval [${delta.low.toFixed(3)}, ${delta.high.toFixed(3)}], 2,000 resamples. ${delta.low>0?'The interval excludes zero for this scoped comparison.':'The interval includes zero; superiority remains uncertain.'}`));
  $('study-freeze').textContent=`The selected model, protocol and evaluation source were pushed before these test labels were opened. All 64 selected test papers exclude the 32 papers from v1. No fresh-test tuning.`;
  $('study-commit').href=`https://github.com/FrenchDonovan/Aurora/commit/${report.pretest_commit}`;
  $('study-commit').textContent=`Pre-test freeze ${report.pretest_commit.slice(0,7)} ↗`;
  const tp=model.training_provenance;
  $('study-population').textContent=`Training: ${tp.training_queries.toLocaleString()} usable query groups / ${tp.training_pairs.toLocaleString()} candidate pairs from the official training partition. Selection: ${tp.validation_queries} eligible development questions, 90 candidate settings. Test: ${report.test_audit.all_questions} original → ${report.test.eligible_queries} eligible questions; ${report.test_audit.duplicate_question_excluded} normalized duplicates and ${report.test_audit.no_mapped_text_positive_excluded} without mapped textual positives excluded by protocol. No-positive candidate groups remain in evaluation.`;
  $('study-fingerprints').textContent=`Feature contract\n${TREE_FEATURE_VERSION}\nModel SHA-256\n${hashes.model}\nStatistics SHA-256\n${hashes.statistics}\nProtocol SHA-256\n${report.freeze.protocol_sha256}\nPredictions SHA-256\n${hashes.predictions}`;
  for(const paper of [...corpus.papers].sort((a,b)=>a.title.localeCompare(b.title))){const option=el('option',`${paper.title} [${paper.dataset_partition}]`);option.value=paper.id;$('study-paper').append(option);}
  $('study-method').value=improved?'learned':'bm25';
  let result=null,active=null,removed=new Set();
  function invalidate(){active=null;result=null;$('study-remove-references').disabled=true;$('study-control').disabled=true;$('study-export').disabled=true;}
  function examples(queryID=null){const eligible=queries.filter(q=>q.paper_id===$('study-paper').value);const custom=el('option','Custom question · no reference labels');custom.value='';$('study-example').replaceChildren(custom,...eligible.map(q=>{const o=el('option',`${q.partition}: ${q.question}`);o.value=q.query_id;return o;}));$('study-example').value=queryID??eligible[0]?.query_id??'';selectExample();}
  function selectExample(){const q=queries.find(q=>q.query_id===$('study-example').value);$('study-question').value=q?.question??'';removed.clear();invalidate();$('study-result-title').textContent='Question selected · awaiting a new run';$('study-paragraphs').replaceChildren();$('study-run-summary').textContent='Run this question to inspect the current method. Previous exclusions cleared.';$('study-removed').textContent='';}
  function run(){
    try{
      const next=engine.ask({question:$('study-question').value,paper_id:$('study-paper').value,method:$('study-method').value,excluded_passage_ids:[...removed],top_k:5});
      result=next;active=queries.find(q=>q.paper_id===result.paper_id&&norm(q.question)===norm(result.question))??null;const refs=new Set(active?.reference_ids??[]);
      $('study-result-title').textContent=result.question;
      const method=result.method==='learned'?'CPU LambdaRank':result.method==='local_bm25'?'Local BM25':'Primary BM25';
      $('study-run-summary').textContent=`${method} · ${result.evidence.length} ranked candidates from ${result.diagnostics.allowed_passage_count} allowed paragraphs. ${active?`Reference recall@5: ${pct(result.evidence.filter(p=>refs.has(p.passage_id)).length/refs.size)} against partial QASPER annotations. Reference labels are displayed after ranking and never used as inference features.`:'Custom question: no human reference score is available.'} The uncalibrated lexical brief gate does not verify an answer.`;
      $('study-removed').textContent=`${removed.size} paragraphs excluded before selection. Training IDF and full-paper context/score normalization stay frozen. ${removed.size?'Restore all to undo.':''}`;
      $('study-remove-references').disabled=!active;$('study-control').disabled=!active?.removal;$('study-export').disabled=false;
      $('study-paragraphs').replaceChildren(...result.evidence.map((item,i)=>{
        const card=el('article',undefined,'study-paragraph');card.dataset.passageId=item.passage_id;card.append(el('p',`${String(i+1).padStart(2,'0')} / ${item.section} · ${item.used_in_brief?'LEXICAL BRIEF GATE PASSED':'WEAK CANDIDATE · NOT USED IN BRIEF'}`,'candidate-state'));
        if(active)card.append(el('p',refs.has(item.passage_id)?'Selected as evidence by a QASPER human respondent':'Not selected in the available partial annotations','reference-state'));
        const detail=el('details');detail.open=i===0;detail.append(el('summary',`Read dataset paragraph · ${item.text.length} characters`),el('blockquote',item.text));card.append(detail,el('p',`Text matches: ${item.matched_text_terms.join(', ')||'none'}. Title matches: ${item.matched_title_terms.join(', ')||'none'}. Relevance score ${item.score.toFixed(4)} is not truth confidence.`));
        const link=el('a','Original paper ↗');link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';card.append(link,button('Exclude paragraph & rerun',()=>{removed.add(item.passage_id);run();}),el('p',`Paragraph ${item.passage_id} · QASPER v0.3 · CC BY 4.0 · text SHA-256 ${item.text_sha256}`,'study-hash'));return card;
      }));if(!result.evidence.length)$('study-paragraphs').append(el('p','No positive-BM25 candidates remain. Restore paragraphs or change the question.'));
      $('study-status').textContent='Replay complete. Actual model inference runs locally in this browser.';
    }catch(error){invalidate();$('study-status').textContent=error.message;}
  }
  function replay(q){$('study-paper').value=q.paper_id;examples(q.query_id);run();$('study-result-title').focus({preventScroll:true});$('study-form').scrollIntoView({block:'start',behavior:'auto'});}
  $('study-paper').addEventListener('change',()=>examples());$('study-example').addEventListener('change',selectExample);
  $('study-question').addEventListener('input',()=>{invalidate();$('study-status').textContent='Question edited. Click Rank paragraphs to replace the displayed previous result. Reference actions and export are disabled until then.';});
  $('study-method').addEventListener('change',()=>{$('study-status').textContent='Method changed. Click Rank paragraphs to replace the previous recorded method.';});
  $('study-form').addEventListener('submit',event=>{event.preventDefault();removed.clear();run();});
  $('study-remove-references').addEventListener('click',()=>{if(active){removed=new Set(active.reference_ids);run();}});
  $('study-control').addEventListener('click',()=>{if(active?.removal){removed=new Set(active.removal.matched_control.removed_ids);run();}});
  $('study-restore').addEventListener('click',()=>{removed.clear();run();});
  $('study-export').addEventListener('click',()=>{if(!result)return;const receipt={schema_version:2,task:report.task,pretest_commit:report.pretest_commit,protocol_sha256:report.freeze.protocol_sha256,model_sha256:result.method==='learned'?hashes.model:null,statistics_sha256:hashes.statistics,model_selection:report.model_selection,result,reference_ids:active?.reference_ids??null,reference_provenance:active?'QASPER original partial human-selected evidence union; unselected paragraphs assumed negative; not new Aurora adjudication':null,limitations:report.limitations};const url=URL.createObjectURL(new Blob([JSON.stringify(receipt,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download='aurora-ranker-v2-replay.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);$('study-status').textContent='Active v2 replay receipt downloaded.';});
  const outcomes=report.test.ndcg_question_outcomes;$('study-atlas-summary').textContent=`All ${predictions.length} eligible fresh-test questions are replayable. Learned nDCG beat the primary BM25 baseline on ${outcomes.wins}, tied on ${outcomes.ties}, and lost on ${outcomes.losses}. This atlas starts with the largest losses.`;
  function atlas(mode){const diff=q=>q.metrics.learned.ndcg_at_k-q.metrics[baseline].ndcg_at_k;const qs=predictions.filter(q=>mode!=='misses'||q.metrics[baseline].recall_at_k===0).sort((a,b)=>(mode==='gains'?diff(b)-diff(a):diff(a)-diff(b))||a.query_id.localeCompare(b.query_id));$('study-atlas').replaceChildren(...qs.slice(0,10).map(q=>{const row=el('article',undefined,'atlas-row');row.append(button(q.question,()=>replay(q)),el('p',`BM25 nDCG ${q.metrics[baseline].ndcg_at_k.toFixed(3)} → learned ${q.metrics.learned.ndcg_at_k.toFixed(3)} · Δ ${diff(q).toFixed(3)} · reference removal retains ${pct(q.removal.reference_removal.top5_retention)} of the learned top five; matched control ${pct(q.removal.matched_control.top5_retention)}.`));return row;}));}
  for(const mode of ['losses','gains','misses'])$(`study-${mode}`).addEventListener('click',()=>atlas(mode));atlas('losses');
  $('study-content').hidden=false;$('study-status').textContent=`Verified ${corpus.papers.length} public papers / ${corpus.passages.length.toLocaleString()} paragraphs, frozen model and training statistics.`;
  const first=predictions.slice().sort((a,b)=>a.query_id.localeCompare(b.query_id))[0];$('study-paper').value=first.paper_id;examples(first.query_id);run();
}
