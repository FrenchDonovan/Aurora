"""Offline ranking evaluation; validation default, final test requires explicit flag."""
import argparse
from collections import defaultdict
import json
import math
from pathlib import Path
import random
from .dataset import load_judgments, validate_judgments
from .features import CorpusIndex, corpus_hash, validate_model


def query_metrics(ranking, judgments, k):
    ids = [row["passage_id"] for row in ranking]
    selected = ids[:k]
    relevant = {pid for pid, grade in judgments.items() if grade > 0}
    direct = {pid for pid, grade in judgments.items() if grade == 2}
    dcg = sum((2 ** judgments.get(pid, 0) - 1) / math.log2(i + 2) for i, pid in enumerate(selected))
    ideal = sum((2 ** grade - 1) / math.log2(i + 2) for i, grade in enumerate(sorted(judgments.values(), reverse=True)[:k]))
    return {
        "ndcg_at_k": dcg / ideal if relevant else None,
        "mrr_at_k": next((1 / (i + 1) for i, pid in enumerate(selected) if pid in relevant), 0.0) if relevant else None,
        "recall_at_k": len(set(selected) & relevant) / len(relevant) if relevant else None,
        "direct_evidence_recall_at_k": len(set(selected) & direct) / len(direct) if direct else None,
        "candidate_recall": len(set(ids) & relevant) / len(relevant) if relevant else None,
        "direct_evidence_candidate_recall": len(set(ids) & direct) / len(direct) if direct else None,
        "judgment_coverage_at_k": sum(pid in judgments for pid in selected) / len(selected) if selected else 1.0,
        "answerable_in_judged_pool": bool(relevant),
        "direct_evidence_in_judged_pool": bool(direct),
        "relevant_judged_passages": len(relevant),
        "direct_evidence_judged_passages": len(direct),
    }


def evaluate(index, rows, *, split="validation", model=None, k=5, bootstrap_samples=1000, seed=17):
    rows = validate_judgments(rows, index, allow_synthetic=True)
    if split not in {"train", "validation", "test"} or type(k) is not int or k < 1 or k > 20 or type(bootstrap_samples) is not int or bootstrap_samples < 0:
        raise ValueError("Invalid evaluation configuration")
    grouped = defaultdict(list)
    for row in rows:
        if row["split"] == split:
            grouped[row["query_id"]].append(row)
    if not grouped:
        raise ValueError(f"No queries in {split} split")
    predictions = []
    for query_id, group in sorted(grouped.items()):
        question = group[0]["question"]
        judgments = {row["passage_id"]: row["relevance"] for row in group}
        baseline = index.rank(question)
        learned = index.rank(question, model) if model else None
        predictions.append({"query_id": query_id, "question_family": group[0]["question_family"], "judged_passages": len(judgments), "corpus_passages": len(index.docs), "bm25": {"ranking": baseline, "metrics": query_metrics(baseline, judgments, k)}, **({"learned": {"ranking": learned, "metrics": query_metrics(learned, judgments, k)}} if model else {})})
    # Ranking retrieval metrics have a defined denominator only when the judged
    # pool contains relevant evidence. A no-positive query is NOT a zero-quality
    # retrieval observation, nor proof that the wider literature has no answer.
    retrieval_predictions = [row for row in predictions if row["bm25"]["metrics"]["answerable_in_judged_pool"]]
    unanswerable_predictions = [row for row in predictions if not row["bm25"]["metrics"]["answerable_in_judged_pool"]]
    for prediction in predictions:
        prediction["population"] = "judged_answerable" if prediction["bm25"]["metrics"]["answerable_in_judged_pool"] else "no_relevant_passage_in_judged_pool"
    # Average eligible questions within family, then equally weight families.
    # A mixed family's no-positive members do not dilute its retrieval metrics.
    by_family = defaultdict(list)
    for prediction in retrieval_predictions:
        by_family[prediction["question_family"]].append(prediction)
    names = ["ndcg_at_k", "mrr_at_k", "recall_at_k", "direct_evidence_recall_at_k", "candidate_recall", "direct_evidence_candidate_recall", "judgment_coverage_at_k"]
    methods = ["bm25"] + (["learned"] if model else [])

    def defined_mean(values):
        available = [value for value in values if value is not None]
        return sum(available) / len(available) if available else None

    family_metrics = {family: {method: {name: defined_mean([row[method]["metrics"][name] for row in members]) for name in names} for method in methods} for family, members in by_family.items()}
    aggregate = {method: {name: defined_mean([values[method][name] for values in family_metrics.values()]) for name in names} for method in methods}
    metric_populations = {name: {"eligible_queries": sum(row["bm25"]["metrics"][name] is not None for row in retrieval_predictions), "eligible_question_families": sum(values["bm25"][name] is not None for values in family_metrics.values())} for name in names}
    intervals = None
    if model:
        differences = [values["learned"]["ndcg_at_k"] - values["bm25"]["ndcg_at_k"] for values in family_metrics.values()]
        intervals = {"metric": "paired_family_ndcg_at_k_difference", "point": defined_mean(differences), "percentile_95": None, "eligible_question_families": len(differences), "samples": 0, "requested_samples": bootstrap_samples, "seed": seed, "status": "insufficient_eligible_families" if len(differences) < 2 else "disabled", "note": "Only judged-answerable questions enter paired family means. At least two eligible families are required for an interval; even then small convenience samples do not establish generalization."}
        if len(differences) >= 2 and bootstrap_samples:
            rng = random.Random(seed)
            samples = sorted(sum(rng.choice(differences) for _ in differences) / len(differences) for _ in range(bootstrap_samples))
            intervals.update(status="exploratory", samples=bootstrap_samples, percentile_95=[samples[int(0.025*(len(samples)-1))], samples[int(0.975*(len(samples)-1))]])
    all_families = {row["question_family"] for row in predictions}
    unanswerable_families = {row["question_family"] for row in unanswerable_predictions}
    return {"schema_version": 1, "status": "synthetic_test_only" if any(row["synthetic"] for row in rows) else "pilot", "split": split, "protocol": "question_family_disjoint_fixed_corpus", "corpus_version": index.corpus["corpus_version"], "corpus_sha256": corpus_hash(index.corpus), "model_id": model["model_id"] if model else None, "question_count": len(predictions), "question_family_count": len(all_families), "retrieval_query_count": len(retrieval_predictions), "retrieval_question_family_count": len(by_family), "unanswerable_query_count": len(unanswerable_predictions), "unanswerable_question_family_count": len(unanswerable_families), "mixed_question_family_count": len(set(by_family) & unanswerable_families), "retrieval_population": "questions with at least one grade>0 passage in the judged pool; direct-evidence recall additionally requires grade=2", "metric_populations": metric_populations, "k": k, "metrics": aggregate, "family_metrics": family_metrics, "paired_bootstrap": intervals, "predictions": predictions, "retrieval_predictions": retrieval_predictions, "unanswerable_predictions": unanswerable_predictions, "limitations": ["Metrics concern relevance over the judged pool, not scientific support or truth.", "No-positive judged pools are reported separately, never averaged as zero retrieval scores; they do not establish absence of evidence elsewhere.", "Broad recall counts grade>0; direct-evidence recall counts grade=2 and is null if its eligible population is empty.", "Unjudged passages count as zero gain; report judgment coverage and collect a complete pool before confirmatory claims.", "Candidate generation excludes zero-BM25 passages for both methods; candidate recall reveals that limitation.", "Question families were assigned by curators; semantic paraphrase leakage is not automatically detectable.", "No source-family-disjoint generalization claim. No evaluated answerability calibration, refusal quality or semantic verification claim."]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus", required=True); parser.add_argument("--judgments", required=True); parser.add_argument("--model"); parser.add_argument("--output", required=True)
    parser.add_argument("--split", choices=["train", "validation", "test"], default="validation"); parser.add_argument("--allow-test", action="store_true")
    parser.add_argument("--allow-synthetic", action="store_true"); parser.add_argument("--k", type=int, default=5)
    args = parser.parse_args()
    if args.split == "test" and not args.allow_test:
        parser.error("Final test evaluation requires --allow-test; freeze configuration before inspecting it")
    corpus = json.loads(Path(args.corpus).read_text(encoding="utf-8-sig")); index = CorpusIndex(corpus)
    rows, dataset_hash = load_judgments(args.judgments, index, args.allow_synthetic)
    model = validate_model(json.loads(Path(args.model).read_text(encoding="utf-8-sig")), corpus, args.allow_synthetic) if args.model else None
    if model and model["training_provenance"]["dataset_sha256"] != dataset_hash:
        raise ValueError("Evaluation judgment hash differs from model dataset; use the declared frozen dataset")
    result = evaluate(index, rows, split=args.split, model=model, k=args.k)
    result["dataset_sha256"] = dataset_hash
    output = Path(args.output).resolve()
    if result["status"] == "synthetic_test_only" and (Path(__file__).resolve().parents[1] / "tests" / "fixtures").resolve() not in output.parents:
        raise ValueError("Synthetic reports must stay under tests/fixtures")
    output.parent.mkdir(parents=True, exist_ok=True); output.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": result["status"], "split": args.split, "question_count": result["question_count"], "output": str(output)}))


if __name__ == "__main__":
    main()
