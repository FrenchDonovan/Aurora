# Read the implementation

| File | Responsibility | Question to answer before extending it |
| --- | --- | --- |
| `aurora/task.py` | Operator task format and budgets | Which fields may the model see? |
| `aurora/repository.py` | Git snapshots, paths, source patch and replay | Why does a patch need a preimage hash? |
| `aurora/tools.py` | Read, literal search, Python AST, exact edit, fixed tests | Why can't the model choose a command? |
| `aurora/providers.py` | Script replay and Ollama JSON actions | Why is replay useful but not an inference benchmark? |
| `aurora/agent.py` | State transitions, budgets and recovery hint | What happens after malformed JSON or token overrun? |
| `aurora/process.py` | Bounded process output, timeouts and Docker | What survives if only a Docker client is killed? |
| `aurora/evaluation.py` | Known failing baseline and clean candidate grading | Why are acceptance tests withheld from file tools? |
| `aurora/trace.py` | Append-only JSONL events | Can every action be reconstructed? |
| `aurora/failures.py` | Prefix features, Naive Bayes and validation | What information is available when the hint is selected? |
| `aurora/metrics.py` | Task-level summaries and paired statistics | Why reject duplicate tasks instead of picking a run? |
| `aurora/cli.py` | Reproducible entry points | Which command would another person run to reproduce a result? |

## A demo attempt

The parser recursively converts dictionary values but returns lists unchanged. The replay policy lists files, reads the parser, runs public tests, replaces that one line with a recursive list comprehension, runs tests again, and finishes. The evaluator additionally checks deeper nesting, existing values and input preservation.

Open `trace.jsonl` beside `patch.diff` and `summary.json`. Find the original failing public test and compare it to acceptance grading. Then run the integration test that finishes without changing source. It should remain unresolved despite the completion claim.

## The initial ML choice

Multinomial Naive Bayes estimates a failure class from word frequencies, with Laplace smoothing for rare words. It is fast, transparent, and a useful baseline for small CPU datasets. It can overfit traceback vocabulary and repository-specific identifiers. Repository-disjoint validation is therefore more informative than a random row split.

Learned classification and agent improvement are separate questions. Measure both. A future neural model must beat meaningful controls, not merely introduce PyTorch into the dependency list.
