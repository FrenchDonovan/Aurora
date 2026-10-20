"""Label-free feature contract for CPU LambdaRank and browser inference."""
from collections import Counter, defaultdict
import math
import re
import unicodedata
from .features import tokenize, coverage, FEATURE_NAMES as BASE_NAMES

VERSION = 'aurora-context-ranker-v2'
SECTIONS = ['intro', 'related', 'method', 'experiment', 'data', 'conclusion', 'abstract']
TYPES = ['data', 'method', 'result', 'number', 'language', 'definition', 'yesno']
NAMES = BASE_NAMES + ['log_global_text_bm25', 'log_local_text_bm25', 'global_relative', 'global_rank_fraction', 'local_relative', 'local_rank_fraction', 'section_coverage', 'relative_position', 'log_token_count', 'number_density', 'citation_density', 'stem_coverage', 'window40_coverage', 'neighbor_coverage'] + ['section_' + s for s in SECTIONS] + ['question_' + t for t in TYPES] + ['cue_' + t for t in TYPES] + ['interaction_' + t for t in TYPES]


def stem(word):
    for suffix in ['ing','ies','ed','es','s']:
        if len(word) > len(suffix) + 3 and word.endswith(suffix):
            return word[:-len(suffix)] + ('y' if suffix == 'ies' else '')
    return word


def flags(text, section=False):
    t = text.lower()
    if section:
        return [int(bool(re.search(p,t))) for p in [r'introduc|background',r'related|previous',r'method|model|approach|architect|system',r'experiment|result|evaluat|analysis',r'data|corpus|corpora|resource',r'conclu|future|discussion',r'abstract']]
    return [int(bool(re.search(p,t))) for p in [r'\b(data|dataset|corpus|corpora|train|domain|source|collect|benchmark)',r'\b(how|model|method|approach|algorithm|architect|network|layer|embedding)',r'\b(result|perform|accura|improv|evaluat|baseline|score|bleu|f1|state.of.the.art)',r'\b(how many|how much|number|size|percent|ratio|quantity)',r'\b(language|lingual|english|chinese|german|french)',r'\b(what is|what are|define|definition|mean|refer)',r'^(is|are|do|does|did|can|could|has|have|was|were|will)\b']]


def cues(text):
    t=text.lower()
    return [int(bool(re.search(p,t))) for p in [r'\b(data|dataset|corpus|corpora|train|domain|collect|benchmark)',r'\b(model|method|approach|algorithm|architect|network|layer|embedding)',r'\b(result|perform|accura|improv|evaluat|baseline|score|bleu|f1)',r'\d',r'\b(language|lingual|english|chinese|german|french)',r'\b(is|are|means|defined|refer)',r'\b(not|no|yes|however|only|unlike|without)\b']]


class RankIndex:
    def __init__(self, corpus, stats=None):
        papers={p['id']:p for p in corpus['papers']}
        self.corpus=corpus
        self.docs={}
        self.groups=defaultdict(list)
        for p in corpus['passages']:
            paper=papers[p['paper_id']]
            fields={'text':tokenize(p['text']),'title':tokenize(paper['title']),'tags':tokenize(' '.join(paper['topics']))}
            doc={'passage':p,'paper':paper,'fields':fields,'counts':{k:Counter(v) for k,v in fields.items()},'sets':{k:set(v) for k,v in fields.items()}}
            doc.update(section=tokenize(p['section']),section_flags=flags(p['section'],True),cues=cues(p['text']),stems=set(map(stem,fields['text'])),bigrams=set(' '.join(pair) for pair in zip(fields['text'],fields['text'][1:])))
            self.docs[p['id']]=doc;self.groups[p['paper_id']].append(doc)
        self.stats=stats or self.make_stats(list(self.docs.values()))
        self.local={pid:self.make_stats(docs) for pid,docs in self.groups.items()}

    @staticmethod
    def make_stats(docs):
        stats={'document_count':len(docs),'fields':{}}
        for f in ['text','title','tags']:
            df=Counter()
            for d in docs:df.update(d['sets'][f])
            stats['fields'][f]={'df':dict(sorted(df.items())),'avg':sum(len(d['fields'][f]) for d in docs)/(len(docs) or 1) or 1}
        return stats

    @staticmethod
    def bm25(query,doc,stats,fields):
        score=0
        for f,boost in fields.items():
            avg=stats['fields'][f]['avg'];df=stats['fields'][f]['df'];n=stats['document_count'];tokens=doc['fields'][f]
            for q in query:
                tf=doc['counts'][f][q]
                if tf:
                    freq=df.get(q,0)
                    score+=boost*math.log(1+(n-freq+.5)/(freq+.5))*tf*2.2/(tf+1.2*(.25+.75*len(tokens)/avg))
        return score

    def rows(self,question,paper_id):
        query=tokenize(question);qs=set(query);unique=list(dict.fromkeys(query));qst=set(map(stem,query));qbi=set(' '.join(pair) for pair in zip(query,query[1:]));qtypes=flags(question)
        docs=self.groups[paper_id]
        global_scores=[self.bm25(unique,d,self.stats,{'text':1,'title':.35,'tags':.15}) for d in docs]
        text_scores=[self.bm25(unique,d,self.stats,{'text':1}) for d in docs]
        local_scores=[self.bm25(unique,d,self.local[paper_id],{'text':1}) for d in docs]
        rank=lambda scores:{i:r/max(1,len(docs)-1) for r,i in enumerate(sorted(range(len(docs)),key=lambda i:(-scores[i],docs[i]['passage']['id'])))}
        gr,lr=rank(global_scores),rank(local_scores)
        gmax=max(global_scores,default=0) or 1;lmax=max(local_scores,default=0) or 1
        rows=[]
        for i,d in enumerate(docs):
            if global_scores[i]<=0:continue
            pt=d['sets']['text'];qt=qs;union=qt|pt;text=d['fields']['text']
            numbers=[w for w in qs if any(unicodedata.category(c)[0]=='N' for c in w)]
            # Windows cover every token; fixed20-token stride plus final window.
            windows=[set(text[j:j+40]) for j in range(0,max(1,len(text)-39),20)]+[set(text[-40:])]
            neighbors=[docs[j]['sets']['text'] for j in [i-1,i+1] if 0<=j<len(docs)]
            base=[math.log1p(global_scores[i]),coverage(qs,pt),coverage(qs,d['sets']['title']),coverage(qbi,d['bigrams']),len(qt&pt)/len(union) if union else 0,len(pt)/(len(pt)+40),coverage(numbers,pt),coverage(qs,d['sets']['tags'])]
            extra=[math.log1p(text_scores[i]),math.log1p(local_scores[i]),global_scores[i]/gmax,gr[i],local_scores[i]/lmax,lr[i],coverage(qs,d['section']),i/max(1,len(docs)-1),math.log1p(len(text)),sum(any(unicodedata.category(c)[0]=='N' for c in w) for w in text)/max(1,len(text)),sum(w=='bibref' or w.startswith('bibref') for w in text)/max(1,len(text)),coverage(qst,d['stems']),max((coverage(qs,w) for w in windows),default=0),max((coverage(qs,n) for n in neighbors),default=0)]
            vector=base+extra+d['section_flags']+qtypes+d['cues']+[a*b for a,b in zip(qtypes,d['cues'])]
            assert len(vector)==len(NAMES) and all(math.isfinite(v) for v in vector)
            rows.append({'passage_id':d['passage']['id'],'global_bm25':global_scores[i],'local_bm25':local_scores[i],'features':vector})
        return rows


def tree_score(trees,features):
    total=0
    for tree in trees:
        idx=0
        while isinstance(tree[idx],list):
            f,t,left,right=tree[idx];idx=left if features[f]<=t else right
        total+=tree[idx]
    return total


def normalize_scores(scores):
    lo=min(scores,default=0);hi=max(scores,default=0)
    return [(v-lo)/(hi-lo) if hi>lo else 0 for v in scores]
