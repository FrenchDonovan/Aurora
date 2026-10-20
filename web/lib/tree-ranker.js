/** CPU LambdaRank inference. Features contain no answers, reference labels or IDs. */
import {tokenize,FEATURE_NAMES as BASE_NAMES,createEngine,corpusHash,sha256} from './engine.js?v=aurora-ranker-v2';
export const TREE_FEATURE_VERSION='aurora-context-ranker-v2';
const sections=['intro','related','method','experiment','data','conclusion','abstract'];
const types=['data','method','result','number','language','definition','yesno'];
export const TREE_FEATURE_NAMES=[...BASE_NAMES,'log_global_text_bm25','log_local_text_bm25','global_relative','global_rank_fraction','local_relative','local_rank_fraction','section_coverage','relative_position','log_token_count','number_density','citation_density','stem_coverage','window40_coverage','neighbor_coverage',...sections.map(s=>'section_'+s),...types.map(t=>'question_'+t),...types.map(t=>'cue_'+t),...types.map(t=>'interaction_'+t)];
const check=(ok,message)=>{if(!ok)throw Error(message);};
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const unique=a=>[...new Set(a)];
const coverage=(q,d)=>{const a=unique([...q]),b=new Set(d);return a.length?a.filter(t=>b.has(t)).length/a.length:0;};
function stem(word){for(const suffix of ['ing','ies','ed','es','s'])if([...word].length>suffix.length+3&&word.endsWith(suffix))return word.slice(0,-suffix.length)+(suffix==='ies'?'y':'');return word;}
// Python's Unicode word boundaries and decimal-digit definition, mirrored explicitly.
const boundary='(?:(?<![\\p{L}\\p{N}_])(?=[\\p{L}\\p{N}_])|(?<=[\\p{L}\\p{N}_])(?![\\p{L}\\p{N}_]))';
const regex=source=>new RegExp(source.replaceAll('\\b',boundary).replaceAll('\\d','\\p{Nd}'),'u');
const sectionPatterns=['introduc|background','related|previous','method|model|approach|architect|system','experiment|result|evaluat|analysis','data|corpus|corpora|resource','conclu|future|discussion','abstract'].map(regex);
const typePatterns=['\\b(data|dataset|corpus|corpora|train|domain|source|collect|benchmark)','\\b(how|model|method|approach|algorithm|architect|network|layer|embedding)','\\b(result|perform|accura|improv|evaluat|baseline|score|bleu|f1|state.of.the.art)','\\b(how many|how much|number|size|percent|ratio|quantity)','\\b(language|lingual|english|chinese|german|french)','\\b(what is|what are|define|definition|mean|refer)','^(is|are|do|does|did|can|could|has|have|was|were|will)\\b'].map(regex);
const cuePatterns=['\\b(data|dataset|corpus|corpora|train|domain|collect|benchmark)','\\b(model|method|approach|algorithm|architect|network|layer|embedding)','\\b(result|perform|accura|improv|evaluat|baseline|score|bleu|f1)','\\d','\\b(language|lingual|english|chinese|german|french)','\\b(is|are|means|defined|refer)','\\b(not|no|yes|however|only|unlike|without)\\b'].map(regex);
const flags=(text,patterns)=>patterns.map(p=>Number(p.test(text.toLowerCase())));
const bigrams=tokens=>tokens.slice(1).map((word,i)=>`${tokens[i]} ${word}`);
const counter=values=>{const counts=new Map();for(const v of values)counts.set(v,(counts.get(v)||0)+1);return counts;};
function makeStats(docs){const fields={};for(const f of ['text','title','tags']){const df=Object.create(null);for(const d of docs)for(const t of d.sets[f])df[t]=(df[t]||0)+1;fields[f]={df,avg:docs.reduce((n,d)=>n+d.fields[f].length,0)/(docs.length||1)||1};}return {document_count:docs.length,fields};}
function bm25(query,doc,stats,fields){let score=0;for(const [field,boost]of Object.entries(fields)){const {avg,df}=stats.fields[field],n=stats.document_count,tokens=doc.fields[field];for(const q of query){const tf=doc.counts[field].get(q)||0;if(tf){const freq=Number.isInteger(df[q])?df[q]:0;score+=boost*Math.log(1+(n-freq+.5)/(freq+.5))*tf*2.2/(tf+1.2*(.25+.75*tokens.length/avg));}}}return score;}
export function normalizeTreeScores(scores){const lo=Math.min(...scores),hi=Math.max(...scores);return scores.map(v=>hi>lo?(v-lo)/(hi-lo):0);}
export function predictTrees(trees,features){let sum=0;for(const tree of trees){let index=0;while(Array.isArray(tree[index])){const [f,t,left,right]=tree[index];index=features[f]<=t?left:right;}sum+=tree[index];}return sum;}

export function createTreeIndex(corpus,statistics){
  const papers=new Map(corpus.papers.map(p=>[p.id,p]));const groups=new Map();
  for(const passage of corpus.passages){const paper=papers.get(passage.paper_id),fields={text:tokenize(passage.text),title:tokenize(paper.title),tags:tokenize(paper.topics.join(' '))};const doc={passage,paper,fields,counts:Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,counter(v)])),sets:Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,new Set(v)])),section:tokenize(passage.section),sectionFlags:flags(passage.section,sectionPatterns),cues:flags(passage.text,cuePatterns),stems:new Set(fields.text.map(stem)),bigrams:new Set(bigrams(fields.text))};if(!groups.has(paper.id))groups.set(paper.id,[]);groups.get(paper.id).push(doc);}
  const locals=new Map([...groups].map(([pid,docs])=>[pid,makeStats(docs)]));
  function rows(question,paperID){
    check(groups.has(paperID),'Choose a known paper.');
    const query=tokenize(question),qs=new Set(query),uq=unique(query),qst=new Set(query.map(stem)),qbi=new Set(bigrams(query)),qt=flags(question,typePatterns),docs=groups.get(paperID);
    const gs=docs.map(d=>bm25(uq,d,statistics,{text:1,title:.35,tags:.15})),ts=docs.map(d=>bm25(uq,d,statistics,{text:1})),ls=docs.map(d=>bm25(uq,d,locals.get(paperID),{text:1}));
    const ranks=scores=>{const result=[];docs.map((_,i)=>i).sort((a,b)=>scores[b]-scores[a]||cmp(docs[a].passage.id,docs[b].passage.id)).forEach((i,r)=>result[i]=r/Math.max(1,docs.length-1));return result;};
    const gr=ranks(gs),lr=ranks(ls),gm=Math.max(...gs)||1,lm=Math.max(...ls)||1,result=[];
    docs.forEach((d,i)=>{if(gs[i]<=0)return;const text=d.fields.text,pt=d.sets.text,union=new Set([...qs,...pt]),numbers=uq.filter(t=>/\p{N}/u.test(t));const windows=[];for(let j=0;j<Math.max(1,text.length-39);j+=20)windows.push(new Set(text.slice(j,j+40)));windows.push(new Set(text.slice(-40)));const neighbors=[i-1,i+1].filter(j=>j>=0&&j<docs.length).map(j=>docs[j].sets.text);
      const base=[Math.log1p(gs[i]),coverage(qs,pt),coverage(qs,d.sets.title),coverage(qbi,d.bigrams),union.size?[...qs].filter(t=>pt.has(t)).length/union.size:0,pt.size/(pt.size+40),coverage(numbers,pt),coverage(qs,d.sets.tags)];
      const extra=[Math.log1p(ts[i]),Math.log1p(ls[i]),gs[i]/gm,gr[i],ls[i]/lm,lr[i],coverage(qs,d.section),i/Math.max(1,docs.length-1),Math.log1p(text.length),text.filter(w=>/\p{N}/u.test(w)).length/Math.max(1,text.length),text.filter(w=>w.startsWith('bibref')).length/Math.max(1,text.length),coverage(qst,d.stems),Math.max(0,...windows.map(w=>coverage(qs,w))),Math.max(0,...neighbors.map(n=>coverage(qs,n)))];
      const features=[...base,...extra,...d.sectionFlags,...qt,...d.cues,...qt.map((q,j)=>q*d.cues[j])];result.push({passage_id:d.passage.id,doc:d,global_bm25:gs[i],local_bm25:ls[i],features});
    });return result;
  }
  return {rows,groups};
}

function validateModel(model,corpus,statistics,statisticsHash){
  check(model?.schema_version===2&&model.algorithm==='lightgbm_lambdarank_v2'&&model.feature_version===TREE_FEATURE_VERSION,'Incompatible LambdaRank model.');
  check(JSON.stringify(model.feature_names)===JSON.stringify(TREE_FEATURE_NAMES),'Feature contract mismatch.');
  check(model.synthetic===false&&model.pilot===true&&model.training_provenance?.training_queries>0,'Real-data pilot training provenance required.');
  check(model.corpus_sha256===corpusHash(corpus),'Model corpus fingerprint mismatch.');
  check(/^[0-9a-f]{64}$/.test(statisticsHash)&&model.statistics_sha256===statisticsHash,'Statistics fingerprint mismatch.');
  check(Number.isInteger(statistics.document_count)&&statistics.document_count>0,'Invalid training statistics.');
  for(const field of ['text','title','tags']){const s=statistics.fields?.[field];check(Number.isFinite(s?.avg)&&s.avg>0&&s.df&&typeof s.df==='object','Invalid field statistics.');for(const freq of Object.values(s.df))check(Number.isInteger(freq)&&freq>=0&&freq<=statistics.document_count,'Invalid document frequency.');}
  check(['global_bm25','local_bm25'].includes(model.blend?.baseline)&&Number.isFinite(model.blend.learned_fraction)&&model.blend.learned_fraction>=0&&model.blend.learned_fraction<=1,'Invalid score blend.');
  check(Array.isArray(model.trees)&&model.trees.length>0&&model.trees.length<=600,'Invalid tree count.');
  for(const tree of model.trees){check(Array.isArray(tree)&&tree.length>0&&tree.length<=127,'Invalid tree.');const visited=new Set();function visit(i,path,depth){check(Number.isInteger(i)&&i>=0&&i<tree.length&&!path.has(i)&&depth<=32,'Invalid or cyclic tree.');if(visited.has(i))return;visited.add(i);const item=tree[i];if(Array.isArray(item)){const [f,t,l,r]=item;check(item.length===4&&Number.isInteger(f)&&f>=0&&f<TREE_FEATURE_NAMES.length&&Number.isFinite(t),'Invalid split.');const next=new Set([...path,i]);visit(l,next,depth+1);visit(r,next,depth+1);}else check(Number.isFinite(item),'Invalid leaf.');}visit(0,new Set(),0);check(visited.size===tree.length,'Unreachable tree nodes.');}
}

export function createTreeEngine(inputCorpus,{model:inputModel,statistics:inputStatistics,statisticsHash}={}){
  const corpus=structuredClone(inputCorpus),model=structuredClone(inputModel),statistics=structuredClone(inputStatistics);
  createEngine(corpus);validateModel(model,corpus,statistics,statisticsHash);
  const index=createTreeIndex(corpus,statistics),hash=corpusHash(corpus);
  function ask({question,paper_id,method='learned',excluded_passage_ids=[],top_k=5}={}){
    const started=performance.now();check(typeof question==='string'&&question.trim()&&question.length<=1200,'Enter a question of 1–1,200 characters.');check(['bm25','learned','global_bm25','local_bm25'].includes(method),'Unknown ranker method.');check(Number.isInteger(top_k)&&top_k>=1&&top_k<=20,'top_k must be 1–20.');
    const docs=index.groups.get(paper_id);check(docs,'Choose a known paper.');const known=new Set(docs.map(d=>d.passage.id));check(Array.isArray(excluded_passage_ids)&&excluded_passage_ids.every(id=>known.has(id)),'Excluded paragraphs must belong to the selected paper.');
    const excluded=new Set(excluded_passage_ids),rows=index.rows(question,paper_id),baseline=model.blend.baseline,raw=rows.map(r=>predictTrees(model.trees,r.features)),ln=normalizeTreeScores(raw),bn=normalizeTreeScores(rows.map(r=>r[baseline])),alpha=model.blend.learned_fraction;
    rows.forEach((r,i)=>{r.raw_tree_score=raw[i];r.score=method==='learned'?alpha*ln[i]+(1-alpha)*bn[i]:r[method==='bm25'?baseline:method];});
    const candidates=rows.filter(r=>!excluded.has(r.passage_id)).sort((a,b)=>b.score-a.score||cmp(a.passage_id,b.passage_id));const query=unique(tokenize(question));
    const evidence=candidates.slice(0,top_k).map(r=>{const {passage:p,paper,fields}=r.doc,matched=query.filter(t=>fields.text.includes(t)),title=query.filter(t=>fields.title.includes(t)),used=matched.length>=1&&unique([...matched,...title]).length>=Math.min(2,query.length)&&coverage(query,[...fields.text,...fields.title])>=.35;return {passage_id:p.id,paper_id:paper.id,title:paper.title,authors:paper.authors,year:paper.year,url:paper.url,source_url:p.source_url,text:p.text,section:p.section,text_kind:p.text_kind,text_sha256:sha256(p.text),used_in_brief:used,matched_text_terms:matched,matched_title_terms:title,score:r.score,lexical_score:r.global_bm25,raw_tree_score:method==='learned'?r.raw_tree_score:null,score_kind:method==='learned'?'lambdarank_relevance_not_confidence':'bm25_relevance',features:r.features};});
    const claims=evidence.filter(e=>e.used_in_brief).map(e=>({text:e.text,passage_ids:[e.passage_id],kind:'extractive'}));
    return {schema_version:2,question:question.trim(),paper_id,method,model_id:method==='learned'?model.model_id:null,corpus_sha256:hash,corpus_version:corpus.corpus_version,feature_version:TREE_FEATURE_VERSION,statistics_sha256:statisticsHash,excluded_passage_ids:[...excluded].sort(cmp),excluded_paper_ids:[],evidence,claims,status:claims.length?'evidence_found':'insufficient_evidence',response_mode:'extractive',brief:claims.length?'QASPER-extracted wording; relevance is not answer verification:\n'+claims.map(c=>c.text+' ['+c.passage_ids[0]+']').join('\n'):'Insufficient evidence passed the uncalibrated lexical brief gate. This does not establish that no answer exists.',limitations:['QASPER dataset extractions, not independently verified current-PDF quotations.','Partial human-selected reference union; unselected paragraphs are assumed negatives, not individually human-adjudicated irrelevant.','Known-paper retrieval pilot; scores and lexical brief gate do not establish truth, entailment or answerability.','Global IDF is fitted to training text only; local paper statistics, score/rank normalization and context are frozen before exclusions.','Training/development selection and a fresh paper-disjoint test are recorded separately. Public test labels must not be reused as untouched evaluation.','RL and the old negative logistic study remain separate; these results imply no new RL or semantic-verification improvement.'],diagnostics:{allowed_passage_count:docs.length-excluded.size,candidate_count:candidates.length,elapsed_ms:performance.now()-started,primary_bm25:baseline,blend:model.blend,top_k,index_statistics:'training_global_and_frozen_input_paper',gate:'heuristic_v1'}};
  }
  return {ask};
}
