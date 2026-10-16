"""Synthetic behavior tests only. Passing tests are not evidence of scientific quality."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from research.dataset import load_judgments
from research.features import CorpusIndex, FEATURE_NAMES, corpus_hash, predict, tokenize, validate_model
from research.train_ranker import fit
from research.evaluate import evaluate, query_metrics

FIXTURES = Path(__file__).parent / "fixtures"


class ResearchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.corpus = json.loads((FIXTURES/"synthetic-corpus.json").read_text(encoding="utf-8"))
        cls.index = CorpusIndex(cls.corpus)
        cls.rows, cls.dataset_hash = load_judgments(FIXTURES/"synthetic-judgments.jsonl", cls.index, allow_synthetic=True)

    def load_changed(self, mutate, allow_synthetic=True):
        rows = copy.deepcopy(self.rows); mutate(rows)
        with tempfile.TemporaryDirectory(dir=FIXTURES, prefix="synthetic-tmp-") as directory:
            target = Path(directory)/"judgments.jsonl"
            target.write_text("\n".join(json.dumps(row) for row in rows), encoding="utf-8")
            return load_judgments(target, self.index, allow_synthetic)

    def test_dataset_is_explicitly_synthetic_and_not_deployable(self):
        with self.assertRaisesRegex(ValueError, "Synthetic judgments"):
            load_judgments(FIXTURES/"synthetic-judgments.jsonl", self.index)
        model = fit(self.index,self.rows,self.dataset_hash,epochs=40)
        self.assertTrue(model["synthetic"]); self.assertTrue(model["pilot"])
        with self.assertRaisesRegex(ValueError,"Synthetic model"):
            validate_model(model,self.corpus)

    def test_family_leakage_and_disguised_duplicate_questions_rejected(self):
        def same_family(rows): rows[8]["question_family"] = rows[0]["question_family"]
        def duplicate_question(rows): rows[8]["question"] = rows[0]["question"]
        for mutate in [same_family,duplicate_question]:
            with self.assertRaisesRegex(ValueError,"leakage|Duplicate normalized"):
                self.load_changed(mutate)

    def test_unknown_ids_duplicates_invalid_labels_and_unreviewed_real_rows_rejected(self):
        mutations = [lambda rows: rows[0].update(passage_id="unknown"), lambda rows: rows.append(rows[0]), lambda rows: rows[0].update(relevance=True),lambda rows:rows[0].update(synthetic=False),lambda rows:rows[0].update(split="random")]
        for mutate in mutations:
            with self.assertRaises(ValueError): self.load_changed(mutate)

    def test_real_label_schema_requires_review_provenance(self):
        # Structurally exercises the review gate; these remain synthetic test rows in memory.
        with self.assertRaisesRegex(ValueError,"reviewed:true"):
            self.load_changed(lambda rows: rows[0].update(synthetic=False,reviewed=True,label_provenance=""))

    def test_public_challenge_cannot_be_heldout_gold(self):
        def mutate(rows):
            for row in rows[12:]: row["question"] = self.corpus["challenges"][0]["question"]
        with self.assertRaisesRegex(ValueError,"Public development"):
            self.load_changed(mutate)

    def test_training_is_reproducible_optimizes_loss_and_never_uses_validation_or_test_labels(self):
        model = fit(self.index,self.rows,self.dataset_hash,epochs=100)
        again = fit(self.index,self.rows,self.dataset_hash,epochs=100)
        self.assertEqual(model,again)
        history=model["training_diagnostics"]
        self.assertLess(history[-1]["training_log_loss"],history[0]["training_log_loss"])
        changed=copy.deepcopy(self.rows)
        for row in changed:
            if row["split"] != "train": row["relevance"] = 2-row["relevance"]
        untouched=fit(self.index,changed,self.dataset_hash,epochs=100)
        self.assertEqual(model["weights"],untouched["weights"]); self.assertEqual(model["bias"],untouched["bias"])
        self.assertEqual(len(model["weights"]),len(FEATURE_NAMES))

    def test_known_metrics_and_empty_candidate_behavior(self):
        ranking=[{"passage_id":"b"},{"passage_id":"a"}]
        metrics=query_metrics(ranking,{"a":2,"b":0},2)
        self.assertEqual(metrics["mrr_at_k"],.5)
        self.assertAlmostEqual(metrics["ndcg_at_k"],1/__import__('math').log2(3))
        self.assertEqual(metrics["candidate_recall"],1)
        self.assertEqual(query_metrics([],{"a":2},2)["candidate_recall"],0)

    def test_direct_evidence_recall_is_separate_from_contextual_recall(self):
        metrics=query_metrics([{"passage_id":"context"}],{"direct":2,"context":1,"irrelevant":0},1)
        self.assertEqual(metrics["recall_at_k"],.5)
        self.assertEqual(metrics["direct_evidence_recall_at_k"],0)
        self.assertEqual(metrics["direct_evidence_candidate_recall"],0)
        contextual_only=query_metrics([{"passage_id":"context"}],{"context":1},1)
        self.assertEqual(contextual_only["recall_at_k"],1)
        self.assertIsNone(contextual_only["direct_evidence_recall_at_k"])
        no_positive=query_metrics([{"passage_id":"irrelevant"}],{"irrelevant":0},1)
        for name in ["ndcg_at_k","mrr_at_k","recall_at_k","direct_evidence_recall_at_k","candidate_recall","direct_evidence_candidate_recall"]:
            self.assertIsNone(no_positive[name])
        self.assertFalse(no_positive["answerable_in_judged_pool"])
        self.assertEqual(no_positive["judgment_coverage_at_k"],1)

    def evaluation_fixture_rows(self, specifications):
        # All constructed judgments remain synthetic behavior fixtures, not studies.
        rows=[]
        for query_id,question,family,grades in specifications:
            for passage_id in self.index.docs:
                rows.append({"query_id":query_id,"question":question,"question_family":family,"passage_id":passage_id,"relevance":grades.get(passage_id,0),"split":"validation","annotator":"synthetic-test-generator","synthetic":True})
        return rows

    def test_all_unanswerable_population_has_null_retrieval_metrics_and_no_interval(self):
        model=fit(self.index,self.rows,self.dataset_hash,epochs=20)
        result=evaluate(self.index,self.rows,split="test",model=model,bootstrap_samples=40)
        self.assertEqual(result["question_count"],1)
        self.assertEqual(result["retrieval_query_count"],0)
        self.assertEqual(result["unanswerable_query_count"],1)
        self.assertEqual(result["retrieval_predictions"],[])
        self.assertEqual(result["unanswerable_predictions"][0]["query_id"],"synthetic-q4")
        self.assertTrue(all(value is None for value in result["metrics"]["bm25"].values()))
        self.assertEqual(result["paired_bootstrap"]["status"],"insufficient_eligible_families")
        self.assertIsNone(result["paired_bootstrap"]["point"])
        self.assertIsNone(result["paired_bootstrap"]["percentile_95"])
        self.assertEqual(result["paired_bootstrap"]["samples"],0)

    def test_family_aggregation_ignores_no_positive_members_and_weights_eligible_families(self):
        rows=self.evaluation_fixture_rows([
            ("a1","accuracy degradation","family-a",{"synthetic-p-a":2}),
            ("a2","volcano geology","family-a",{"synthetic-p-a":2}),
            ("a-negative","accuracy volcano detail","family-a",{}),
            ("b1","memory reads tiling","family-b",{"synthetic-p-b":1}),
            ("negative","dinosaur geography","family-negative",{}),
        ])
        result=evaluate(self.index,rows,k=1)
        self.assertEqual(result["retrieval_query_count"],3)
        self.assertEqual(result["retrieval_question_family_count"],2)
        self.assertEqual(result["unanswerable_query_count"],2)
        self.assertEqual(result["mixed_question_family_count"],1)
        self.assertEqual(result["family_metrics"]["family-a"]["bm25"]["recall_at_k"],.5)
        self.assertEqual(result["metrics"]["bm25"]["recall_at_k"],.75)
        self.assertEqual(result["metrics"]["bm25"]["direct_evidence_recall_at_k"],.5)
        self.assertEqual(result["metric_populations"]["recall_at_k"],{"eligible_queries":3,"eligible_question_families":2})
        self.assertEqual(result["metric_populations"]["direct_evidence_recall_at_k"],{"eligible_queries":2,"eligible_question_families":1})
        self.assertNotIn("family-negative",result["family_metrics"])

    def test_paired_bootstrap_uses_only_eligible_families_and_handles_single_family(self):
        model=fit(self.index,self.rows,self.dataset_hash,epochs=20)
        positive=self.evaluation_fixture_rows([
            ("a","accuracy degradation","family-a",{"synthetic-p-a":2}),
            ("b","memory reads tiling","family-b",{"synthetic-p-b":2}),
        ])
        negatives=self.evaluation_fixture_rows([("negative","dinosaur geography","family-negative",{})])
        without=evaluate(self.index,positive,model=model,bootstrap_samples=40)
        with_negative=evaluate(self.index,positive+negatives,model=model,bootstrap_samples=40)
        self.assertEqual(without["paired_bootstrap"],with_negative["paired_bootstrap"])
        self.assertEqual(with_negative["paired_bootstrap"]["eligible_question_families"],2)
        self.assertEqual(with_negative["paired_bootstrap"]["status"],"exploratory")
        single=evaluate(self.index,positive[:len(self.index.docs)]+negatives,model=model,bootstrap_samples=40)
        self.assertEqual(single["paired_bootstrap"]["eligible_question_families"],1)
        self.assertEqual(single["paired_bootstrap"]["status"],"insufficient_eligible_families")
        self.assertIsNone(single["paired_bootstrap"]["percentile_95"])

    def test_evaluation_separates_family_metrics_and_has_honest_status(self):
        model=fit(self.index,self.rows,self.dataset_hash,epochs=50)
        result=evaluate(self.index,self.rows,model=model,bootstrap_samples=40)
        self.assertEqual(result["status"],"synthetic_test_only")
        self.assertEqual(result["split"],"validation")
        self.assertEqual(result["question_family_count"],1)
        self.assertEqual(result["corpus_sha256"],corpus_hash(self.corpus))
        self.assertIsNotNone(result["paired_bootstrap"])
        self.assertIn("judgment_coverage_at_k",result["metrics"]["bm25"])
        self.assertTrue(all(item["query_id"]=="synthetic-q3" for item in result["predictions"]))

    def test_unicode_and_exclusion_candidate_parity_inputs(self):
        self.assertEqual(tokenize("École ８-BIT and café!"),["école","8","bit","café"])
        ranked=self.index.rank("4 bit accuracy",excluded_paper_ids=["synthetic-alpha"])
        self.assertTrue(all(row["passage_id"]!="synthetic-p-a" for row in ranked))
        with self.assertRaisesRegex(ValueError,"Unknown excluded"):
            self.index.rank("accuracy",excluded_paper_ids=["unknown"])

    def test_incompatible_feature_or_corpus_signatures_reject(self):
        model=fit(self.index,self.rows,self.dataset_hash,epochs=10)
        validate_model(model,self.corpus,allow_synthetic=True)
        altered=copy.deepcopy(model); altered["feature_names"]=list(reversed(FEATURE_NAMES))
        with self.assertRaisesRegex(ValueError,"features"):
            validate_model(altered,self.corpus,allow_synthetic=True)
        corpus=copy.deepcopy(self.corpus);corpus["passages"][0]["text"]="changed"
        with self.assertRaisesRegex(ValueError,"corpus signature"):
            validate_model(model,corpus,allow_synthetic=True)

    def test_committed_python_js_parity_fixture_remains_reproducible(self):
        fixture=json.loads((FIXTURES/"synthetic-parity.json").read_text(encoding="utf-8"))
        self.assertEqual(fixture["model"],fit(self.index,self.rows,self.dataset_hash,epochs=100))
        for query in fixture["queries"]:
            for row in query["rows"]:
                self.assertEqual(row["features"],self.index.features(query["question"],row["passage_id"]))
                self.assertEqual(row["learned_score"],predict(fixture["model"],row["features"]))


if __name__ == "__main__": unittest.main()
