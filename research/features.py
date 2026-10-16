"""Frozen lexical transforms, mirrored in web/lib/engine.js (standard library)."""
import hashlib
import json
import math
import re
import unicodedata
from collections import Counter

FEATURE_VERSION = "aurora-lexical-v1"
FEATURE_NAMES = ["log1p_bm25", "passage_coverage", "title_coverage", "bigram_coverage", "token_jaccard", "length_saturation", "numeric_coverage", "tag_coverage"]
STOPWORDS = set("a an and are as at be by can do does for from how in is it of on or that the this to was what when which with".split())
FIELD_WEIGHTS = {"text": 1, "title": 0.35, "tags": 0.15}


def canonical_json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def corpus_hash(corpus):
    return hashlib.sha256(canonical_json(corpus).encode("utf-8")).hexdigest()


def normalize_question(question):
    return " ".join(unicodedata.normalize("NFKC", question).lower().split())


def tokenize(text):
    normalized = unicodedata.normalize("NFKC", str(text)).lower()
    # Unicode categories L and N match JS \p{L}/\p{N}, including non-ASCII numerals.
    words, current = [], []
    for char in normalized:
        if unicodedata.category(char)[0] in "LN":
            current.append(char)
        elif current:
            words.append("".join(current)); current = []
    if current:
        words.append("".join(current))
    return [word for word in words if word not in STOPWORDS]


def coverage(query, document):
    q, d = set(query), set(document)
    return len(q & d) / len(q) if q else 0.0


class CorpusIndex:
    def __init__(self, corpus):
        if corpus.get("schema_version") != 1 or not isinstance(corpus.get("papers"), list) or not isinstance(corpus.get("passages"), list):
            raise ValueError("Unsupported corpus schema")
        self.corpus = corpus
        self.papers = {paper["id"]: paper for paper in corpus["papers"]}
        if len(self.papers) != len(corpus["papers"]):
            raise ValueError("Duplicate paper ID")
        self.docs = {}
        for passage in corpus["passages"]:
            if passage["id"] in self.docs or passage["paper_id"] not in self.papers:
                raise ValueError("Duplicate passage or unknown paper")
            if passage.get("text_kind") != "verbatim_excerpt" or not isinstance(passage.get("text"), str) or not passage["text"].strip():
                raise ValueError("Only nonempty verbatim excerpts may be indexed")
            paper = self.papers[passage["paper_id"]]
            self.docs[passage["id"]] = {"passage": passage, "paper": paper, "fields": {"text": tokenize(passage["text"]), "title": tokenize(paper["title"]), "tags": tokenize(" ".join(paper["topics"]))}}
        self.stats = {}
        for field in FIELD_WEIGHTS:
            df = Counter()
            for doc in self.docs.values():
                df.update(set(doc["fields"][field]))
            self.stats[field] = {"df": df, "avg": sum(len(doc["fields"][field]) for doc in self.docs.values()) / (len(self.docs) or 1) or 1}

    def bm25(self, question, passage_id):
        query = list(dict.fromkeys(tokenize(question)))
        doc = self.docs[passage_id]
        score = 0.0
        for field, boost in FIELD_WEIGHTS.items():
            tokens = doc["fields"][field]
            counts = Counter(tokens)
            stats = self.stats[field]
            for token in query:
                tf = counts[token]
                if not tf:
                    continue
                freq = stats["df"][token]
                idf = math.log(1 + (len(self.docs) - freq + 0.5) / (freq + 0.5))
                score += boost * idf * tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * len(tokens) / stats["avg"]))
        return score

    def features(self, question, passage_id):
        q = tokenize(question)
        doc = self.docs[passage_id]
        pt = set(doc["fields"]["text"])
        qt = set(q)
        bigrams = lambda tokens: [" ".join(pair) for pair in zip(tokens, tokens[1:])]
        union = qt | pt
        return [math.log1p(self.bm25(question, passage_id)), coverage(qt, pt), coverage(qt, doc["fields"]["title"]), coverage(bigrams(q), bigrams(doc["fields"]["text"])), len(qt & pt) / len(union) if union else 0.0, len(pt) / (len(pt) + 40), coverage([word for word in qt if any(unicodedata.category(char)[0] == "N" for char in word)], pt), coverage(qt, doc["fields"]["tags"])]

    def rank(self, question, model=None, excluded_paper_ids=()):
        excluded = set(excluded_paper_ids)
        if excluded - self.papers.keys():
            raise ValueError("Unknown excluded paper IDs")
        ranking = []
        for passage_id, doc in self.docs.items():
            if doc["paper"]["id"] in excluded:
                continue
            lexical = self.bm25(question, passage_id)
            if lexical <= 0:
                continue
            features = self.features(question, passage_id)
            score = predict(model, features) if model else lexical
            ranking.append({"passage_id": passage_id, "score": score, "lexical_score": lexical, "features": features})
        return sorted(ranking, key=lambda row: (-row["score"], row["passage_id"]))


def predict(model, features):
    if len(features) != len(FEATURE_NAMES):
        raise ValueError("Feature vector has wrong length")
    logit = model["bias"] + sum(value * weight for value, weight in zip(features, model["weights"]))
    return 1 / (1 + math.exp(-max(-700, min(700, logit))))


def validate_model(model, corpus, allow_synthetic=False):
    if model.get("schema_version") != 1 or model.get("algorithm") != "linear_logistic_v1" or model.get("feature_version") != FEATURE_VERSION or model.get("feature_names") != FEATURE_NAMES:
        raise ValueError("Incompatible model schema/features")
    weights = model.get("weights")
    if not isinstance(weights, list) or len(weights) != len(FEATURE_NAMES) or not all(isinstance(weight, (int, float)) and not isinstance(weight, bool) and math.isfinite(weight) for weight in weights) or not isinstance(model.get("bias"), (int, float)) or not math.isfinite(model["bias"]):
        raise ValueError("Invalid model coefficients")
    if model.get("transforms") != {"kind": "identity", "feature_version": FEATURE_VERSION}:
        raise ValueError("Incompatible feature transforms")
    provenance = model.get("training_provenance", {})
    if model.get("pilot") is not True or type(model.get("seed")) is not int or not isinstance(model.get("model_id"), str) or not model["model_id"].strip():
        raise ValueError("Missing model identity/pilot provenance")
    if provenance.get("corpus_sha256") != corpus_hash(corpus) or provenance.get("corpus_version") != corpus["corpus_version"]:
        raise ValueError("Incompatible corpus signature")
    if model.get("synthetic") is not False and not allow_synthetic:
        raise ValueError("Synthetic model is not deployable")
    if not provenance.get("leakage_checked") or provenance.get("train_rows", 0) <= 0 or not re.fullmatch(r"[0-9a-f]{64}", str(provenance.get("dataset_sha256", ""))) or not provenance.get("annotators"):
        raise ValueError("Missing training provenance")
    if model.get("synthetic") is False and provenance.get("reviewed_train_rows") != provenance["train_rows"]:
        raise ValueError("Model requires reviewed training labels")
    return model
