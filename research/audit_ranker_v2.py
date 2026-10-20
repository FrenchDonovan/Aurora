"""Separate raw-reference and metric recalculation; not an external peer review."""
import argparse
from collections import defaultdict
import hashlib,json,math,random,unicodedata
from pathlib import Path
from .ranker_v2 import ROOT,WEB,OUT,read,dump
from .features import tokenize


def question_key(text):return ' '.join(unicodedata.normalize('NFKC',text).lower().split())
def text_key(text):return ' '.join(text.split())


def main():
    p=argparse.ArgumentParser();p.add_argument('--raw',type=Path,required=True);a=p.parse_args()
    train=read(a.raw/'qasper-train-v0.3.json');dev=read(a.raw/'qasper-dev-v0.3.json');test=read(a.raw/'qasper-test-v0.3.json')
    old=read(ROOT/'data/qasper/manifest.json');manifest=read(OUT/'manifest.json');report=read(WEB/'report.json');predictions=read(WEB/'predictions.json')
    selected=sorted(set(test)-set(old['selection']['test']),key=lambda pid:hashlib.sha256(('aurora-ranker-v2-test:'+pid).encode()).hexdigest())[:64]
    assert selected==manifest['selection']['test']
    seen={question_key(qa['question']) for data in [train,dev] for paper in data.values() for qa in paper['qas']}
    references={};candidate_sets={};questions={}
    for pid in sorted(selected):
        paper=test[pid];paragraphs={};ids={}
        for section in paper['full_text']:
            for paragraph in section['paragraphs']:
                text=paragraph.strip();key=text_key(text)
                if not text or len(text)>12000 or key in paragraphs:continue
                passage_id=pid+'-p'+str(len(paragraphs)+1).zfill(4);paragraphs[key]=passage_id;ids[passage_id]=text
        for qa in sorted(paper['qas'],key=lambda q:q['question_id']):
            normalized=question_key(qa['question'])
            if normalized in seen:continue
            seen.add(normalized)
            gold=set()
            for answer in qa['answers']:
                if not answer['answer']['unanswerable']:
                    gold.update(paragraphs[text_key(text)] for text in answer['answer']['evidence'] if text_key(text) in paragraphs)
            if not gold:continue
            qid=qa['question_id'];references[qid]=gold;questions[qid]=(pid,qa['question'].strip())
            query=set(tokenize(qa['question']));title=set(tokenize(paper['title']))
            candidate_sets[qid]={passage_id for passage_id,text in ids.items() if query&(set(tokenize(text))|title)}
    assert set(references)=={p['query_id'] for p in predictions}
    metrics=defaultdict(lambda:defaultdict(list));deltas=defaultdict(list);win=loss=tie=0
    for q in predictions:
        qid=q['query_id'];gold=references[qid];assert gold==set(q['reference_ids']);assert questions[qid]==(q['paper_id'],q['question'])
        for method,ranking in q['rankings'].items():
            top=[r['passage_id'] for r in ranking[:5]];ideal=sum(1/math.log2(i+2) for i in range(min(5,len(gold))))
            actual={'ndcg_at_k':sum(1/math.log2(i+2) for i,pid in enumerate(top) if pid in gold)/ideal,'mrr_at_k':next((1/(i+1) for i,pid in enumerate(top) if pid in gold),0),'recall_at_k':len(set(top)&gold)/len(gold),'candidate_recall':len(candidate_sets[qid]&gold)/len(gold)}
            for name,value in actual.items():
                assert abs(value-q['metrics'][method][name])<1e-12,(qid,method,name)
                metrics[method,name][q['paper_id']].append(value)
        baseline=report['test']['primary_baseline'];delta=q['metrics']['learned']['ndcg_at_k']-q['metrics'][baseline]['ndcg_at_k'];deltas[q['paper_id']].append(delta)
        win+=delta>1e-12;loss+=delta<-1e-12;tie+=abs(delta)<=1e-12
        control=set(q['removal']['matched_control']['removed_ids']);assert not(control&gold);assert len(control)==min(len(gold),sum(p['paper_id']==q['paper_id'] and p['id'] not in gold for p in read(WEB/'corpus.json')['passages']))
        assert set(q['removal']['reference_removal']['removed_ids'])==gold
        for item in q['removal'].values():assert not(set(item['ranking'])&set(item['removed_ids']))
    for (method,name),families in metrics.items():
        macro=sum(sum(values)/len(values) for values in families.values())/len(families)
        assert abs(macro-report['test']['paper_macro_metrics'][method][name])<1e-12
    papers=sorted(deltas);paper_deltas=[sum(deltas[f])/len(deltas[f]) for f in papers];rng=random.Random(17)
    samples=sorted(sum(rng.choice(paper_deltas) for _ in paper_deltas)/len(paper_deltas) for _ in range(2000))
    ci=report['test']['paired_learned_minus_bm25_95pct_bootstrap']['ndcg_at_k']
    assert abs(ci['low']-samples[49])<1e-12 and abs(ci['high']-samples[1949])<1e-12
    assert {'wins':win,'ties':tie,'losses':loss}==report['test']['ndcg_question_outcomes']
    result={'audit_kind':'Separate implementation recalculation by project author, not external review','fresh_selection_verified':64,'eligible_reference_sets_reconstructed':len(references),'paper_groups':len(papers),'all_five_methods_metrics_match':True,'primary_ndcg_bootstrap_match':True,'interventions_valid':True,'question_outcomes':{'wins':win,'ties':tie,'losses':loss},'model_sha256':report['freeze']['model_sha256'],'pretest_commit':report['pretest_commit']}
    dump(OUT/'recalculation-audit.json',result);print(json.dumps(result))
if __name__=='__main__':main()
