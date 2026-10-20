"""Native LightGBM goldens on development examples; no final-test annotations."""
import json
from pathlib import Path
import lightgbm as lgb
from .ranker_v2 import ROOT,OUT,WEB,CACHE,read,dump
from .ranker_v2_features import RankIndex


def main():
    corpus=read(WEB/'corpus.json');stats=read(WEB/'statistics.json');manifest=read(OUT/'manifest.json')
    metadata=read(CACHE/'development-metadata.json')
    public_dev=set(manifest['selection']['public_validation_replay'])
    queries=sorted([q for q in metadata if q['paper_id'] in public_dev],key=lambda q:q['query_id'])[:12]
    index=RankIndex(corpus,stats);native=lgb.Booster(model_file=str(OUT/'selected-model.txt'))
    cases=[]
    for q in queries:
        rows=index.rows(q['question'],q['paper_id'])
        scores=native.predict([r['features'] for r in rows],num_threads=2).tolist()
        cases.append({'question':q['question'],'paper_id':q['paper_id'],'rows':[{**r,'native_tree_score':score} for r,score in zip(rows,scores)]})
    dump(ROOT/'tests/fixtures/ranker-v2-validation.json',{'source':'Original QASPER development questions; actual selected native LightGBM model; no fresh test annotations','cases':cases})
    print(json.dumps({'cases':len(cases),'rows':sum(len(c['rows']) for c in cases)}))
if __name__=='__main__':main()
