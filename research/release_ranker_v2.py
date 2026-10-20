"""Package public development replays and fingerprint inventory after test release."""
from .ranker_v2 import ROOT,WEB,OUT,CACHE,read,dump,digest,order,score_metrics
from .ranker_v2_features import RankIndex,tree_score,normalize_scores


def main():
    corpus=read(WEB/'corpus.json');model=read(WEB/'model.json');stats=read(WEB/'statistics.json');manifest=read(OUT/'manifest.json')
    index=RankIndex(corpus,stats);public_dev=set(manifest['selection']['public_validation_replay']);result=[]
    for q in read(CACHE/'development-metadata.json'):
        if q['paper_id'] not in public_dev:continue
        rows=index.rows(q['question'],q['paper_id']);ids=[r['passage_id'] for r in rows];raw=[tree_score(model['trees'],r['features']) for r in rows];alpha=model['blend']['learned_fraction'];baseline=model['blend']['baseline']
        ln=normalize_scores(raw);bn=normalize_scores([r[baseline] for r in rows]);values={'learned':[alpha*a+(1-alpha)*b for a,b in zip(ln,bn)],'global_bm25':[r['global_bm25'] for r in rows],'local_bm25':[r['local_bm25'] for r in rows]}
        item={k:q[k] for k in ['query_id','question','paper_id','partition','reference_ids']}
        ranks={m:order(ids,scores) for m,scores in values.items()};byid={m:dict(zip(ids,scores)) for m,scores in values.items()}
        result.append({**item,'metrics':{m:score_metrics(q,ranked) for m,ranked in ranks.items()},'rankings':{m:[{'passage_id':pid,'score':byid[m][pid]} for pid in ranked[:8]] for m,ranked in ranks.items()},'removal':None})
    dump(WEB/'development-replays.json',result)
    files=['corpus','statistics','model','report','predictions','development-replays']
    dump(WEB/'release.json',{'schema_version':2,'files':{name:digest((WEB/(name+'.json')).read_bytes().rstrip(b'\r\n')) for name in files},'note':'Content fingerprints, not third-party certification. Freeze commit and original model hashes are separately recorded in report.'})
    print({'public_development_replays':len(result),'assets':len(files)})
if __name__=='__main__':main()
