# Failure annotation

Each JSONL row contains a `task_id`, `repository_group`, `split`, manually supplied `label`, observed `text`, and a `synthetic` flag. Keep the stable repository group identical across clones and forks that share task content. A training dataset may contain only train and validation rows.

The export stops at the first observable failure and contains tool observations only. This matches the classifier's intervention point. It deliberately excludes later fixes, independent acceptance results, task outcomes and model completion claims. Label the reason visible in that prefix, not facts only discovered later.

| Label | Use when | Suggested response |
| --- | --- | --- |
| retrieval | The agent has selected irrelevant files or missed the relevant symbol | Inspect the failing symbol and callers |
| edit | Patch text is missing/ambiguous, malformed, or targets a forbidden file | Read source and construct an exact edit |
| test_failure | A relevant test exposes a behavior or regression failure | Inspect assertion, edge cases and traceback |
| environment | Dependencies, permissions or imports prevent meaningful tests | Diagnose setup before changing behavior |
| timeout | Execution exceeded the available timeout | Narrow inspection; avoid identical repeated runs |
| budget | The observed failure is attributable to resource exhaustion | Prioritize the remaining useful action |
| protocol | Action JSON or tool invocation violates the interface | Return a valid documented action |

This is a coarse taxonomy. `retrieval` and `budget` may be difficult to diagnose from a single prefix, and provider failures do not always fit it well. Mark uncertain rows in a separate review queue rather than inventing confident labels. Exclude them from the training file until adjudicated. Review 10–20% with a second annotator if possible and record agreement.

Do not relabel assertion failures based on whether the final patch happened to pass. Do not copy hidden grader output into `text`. Do not treat generated synthetic examples as evidence that the classifier generalizes. A useful label must describe an observable failure and support a specific action.

The JSON model stores token counts from training observations. Treat it as potentially sensitive derived data if repositories contain private source. Review traces, patches, annotations and model files before publishing them.
