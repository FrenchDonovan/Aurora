# Aurora: CPU-first implementation roadmap

The target is a credible engineering and ML experiment. Large-model fine-tuning is optional with CPU-only resources. Advance when a milestone has evidence, not when a calendar week ends.

| Phase | Deliverable | Acceptance evidence | Status |
| --- | --- | --- | --- |
| 1 | Agent, traces, source patch, separate grader | Scripted fixture passes; false success claim fails grading; guardrail tests pass | Implemented locally |
| 2 | Real model baseline on 10–20 curated development tasks | Pinned tasks, complete run inventory, failures investigated | Next |
| 3 | Failure dataset and classifier | Manually reviewed labels; repository-disjoint validation; majority and heuristic controls | Pipeline implemented; real data needed |
| 4 | Controlled learned intervention | Paired baseline/intervention runs with unchanged budgets; report positive or negative findings | Integration implemented; experiment needed |
| 5 | PyTorch comparison on CPU | Train a small text classifier or use frozen code/text embeddings; compare macro-F1, runtime and resolution | Planned |
| 6 | Official held-out benchmark | Separate adapter and official SWE-bench harness, frozen evaluation subset, leakage audit | Planned |
| 7 | Public portfolio | Reviewed GitHub repository, reproducible report, short demo video, measured resume bullets | Planned |

## First session

Run the demo. Read its trace and patch. Read the agent loop and explain why a `finish` message cannot certify success. Change the replay fixture to finish without editing and observe independent grading reject it.

## First real experiment

Start Docker Desktop, choose one small local Ollama coding model that fits RAM, and attempt the prepared demo using `run`. Record the model digest and inference settings. If the model cannot consistently emit valid actions, fix the prompt or adapter on development tasks before freezing the baseline. Keep unsuccessful attempts; they are the data this project needs.

Curate small Python issues whose dependencies fit an operator-built test image. Review repository and dataset licenses. Supply tests that fail for the intended reason at the base commit. Start with several distinct failure types instead of a large benchmark download.

## Learning milestone

Aim initially for 50–100 well-reviewed failure prefixes across multiple repositories. Use repository groups to reserve validation projects before inspecting results. If examples per class are scarce, reduce the taxonomy and document the merge. Prefer useful labels to reaching an arbitrary row count.

Compare the learned classifier against both existing baselines. Then compare agent outcomes with and without its one recovery suggestion. An accurate classifier may produce an ineffective intervention; that is a valid negative result and an opportunity to improve the policy.

## PyTorch and free GPU work

A small PyTorch classifier is feasible on CPU and supplies a deep-learning component without adapting a billion-parameter model. After the bag-of-words baseline, compare a learned embedding plus a linear head or a compact sequence model on the same split. Add PyTorch as an optional training dependency, record seeds and checkpoints, and keep the agent runtime independent of it.

Use a free notebook GPU for a small, time-bounded LoRA pilot only if the earlier experiment warrants it. Check current session limits and dataset/model licenses first. Train on training tasks, retain a fixed validation set, and export adapters and dataset hashes. Do not commit to a 3B–7B fine-tune on CPU or assume free GPU availability.

## Later infrastructure

Add an official SWE-bench adapter only after the curated harness works. Use its official evaluator rather than treating Aurora's local evaluator as an equivalent. Add task checkout/import, dependency images, retries for infrastructure failures, immutable experiment manifests, and complete attempted-task accounting. Near-duplicate detection and model contamination analysis are research work still to do.

PostgreSQL, Parquet, MLflow, FastAPI and a dashboard can follow when they solve demonstrated needs. JSONL and JSON are inspectable and sufficient for the first small study. A UI should display measured evidence already produced by the experiment engine.
