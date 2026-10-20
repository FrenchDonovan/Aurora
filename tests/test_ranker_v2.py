import copy
import hashlib
import json
from pathlib import Path
import unittest
from research.ranker_v2_features import RankIndex,normalize_scores,tree_score
from research.ranker_v2 import summarize

ROOT=Path(__file__).resolve().parents[1]


class RankerV2Tests(unittest.TestCase):
    def test_native_tree_numeric_threshold_and_constant_normalization(self):
        tree=[[[0,.5,1,2],-.2,.7]]
        self.assertEqual(tree_score(tree,[.5]),-.2)
        self.assertEqual(tree_score(tree,[.500000001]),.7)
        self.assertEqual(normalize_scores([3,3]),[0,0])
        self.assertEqual(normalize_scores([]),[])

    def test_label_and_annotation_metadata_cannot_enter_features(self):
        corpus=json.loads((ROOT/'web/data/study-v2/corpus.json').read_text(encoding='utf-8'))
        stats=json.loads((ROOT/'web/data/study-v2/statistics.json').read_text(encoding='utf-8'))
        pid=corpus['papers'][0]['id']
        bounded={**corpus,'papers':[p for p in corpus['papers'] if p['id']==pid],'passages':[p for p in corpus['passages'] if p['paper_id']==pid]}
        before=RankIndex(bounded,stats).rows('What data and methods are used?',pid)
        changed=copy.deepcopy(bounded)
        for p in changed['passages']:p.update(answer='fabricated answer',reference=True,relevance=999)
        changed['labels']={'question':'secret reference'}
        self.assertEqual(before,RankIndex(changed,stats).rows('What data and methods are used?',pid))

    def test_summary_weights_papers_equally_and_retains_losses(self):
        methods=['global_bm25','local_bm25','coverage','v1_logistic','learned']
        def example(pid,learned):
            metrics={m:{k:(learned if m=='learned' else .5) for k in ['ndcg_at_k','mrr_at_k','recall_at_k','candidate_recall']} for m in methods}
            return {'paper_id':pid,'metrics':metrics}
        summary=summarize([example('a',1),example('a',1),example('b',0)],'global_bm25')
        self.assertEqual(summary['paper_macro_metrics']['learned']['ndcg_at_k'],.5)
        self.assertEqual(summary['ndcg_question_outcomes'],{'wins':2,'ties':0,'losses':1})
        self.assertEqual(summary['ndcg_paper_outcomes'],{'wins':1,'ties':0,'losses':1})

    def test_released_sources_and_protocol_still_match_pretest_freeze(self):
        freeze=json.loads((ROOT/'data/ranker-v2/freeze.json').read_text(encoding='utf-8'))
        self.assertEqual(hashlib.sha256((ROOT/'research/RANKER_V2_PROTOCOL.md').read_bytes().replace(b'\r\n',b'\n')).hexdigest(),freeze['protocol_sha256'])
        for file,expected in freeze['source_hashes'].items():
            self.assertEqual(hashlib.sha256((ROOT/file).read_bytes().replace(b'\r\n',b'\n')).hexdigest(),expected,file)

if __name__=='__main__':unittest.main()
