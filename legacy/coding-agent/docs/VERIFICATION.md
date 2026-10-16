# Engineering verification

Verified on Windows with Python 3.12.14 on October 16, 2026.

- The bundled scripted fixture resolved its nested-configuration bug on the local backend. The baseline failed acceptance tests, the exported source patch was replayed onto a fresh snapshot, and independent acceptance plus regression tests passed.
- The 24-test unit/integration suite completed successfully: 23 passed and one symlink-creation check was skipped because this Windows environment denied creation of symlinks.
- Tests include a false completion claim that remains unresolved, invalid-baseline rejection, token-overrun prevention of edits, bounded process output and timeout, unauthorized edits/commands, exact patch preimages, train/validation leakage guards, synthetic supervised learning, and paired metrics.
- Training verification uses synthetic unit-test text, not collected real-world trajectories. No generalization or resolution improvement is established.
- Docker execution was not run locally because the Docker engine was unavailable. CI includes a Linux Docker fixture job; no CI result is claimed before the workflow is run.
- Live Ollama inference was not run because no usable local server/model was available. The HTTP adapter still needs a real-model acceptance run.

The test run used a writable temporary directory inside the Codex workspace because this session's Windows sandbox did not permit normal operations in its default temporary-directory location. This is an environment constraint; normal installations can use their usual temporary directory.

No real GitHub issue benchmark, official SWE-bench result, PyTorch model, LoRA fine-tune, learned agent improvement, or deployment has been produced. These remain explicit milestones in the roadmap.
