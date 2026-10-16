# Execution design and limits

## Trust boundary

Task manifests, evaluator tests, test commands, execution images, and model endpoints belong to the operator. Model actions, repository source, and tool output are untrusted. Do not generate operator manifests from unreviewed repository instructions. Aurora provides no model-controlled shell, package installer, Docker access or arbitrary command tool.

File tools reject absolute paths, Windows drives, traversal, symlinks and junctions. The task enumerates editable source files. Edits use a unique exact preimage. A Git archive creates the initial snapshot, and only permitted source changes are replayed onto a clean candidate. Both baseline and candidate receive a frozen evaluator outside the agent workspace.

These restrictions protect the control path; they do not prove a candidate is correct or prevent malicious code from gaming an in-process evaluator. Tests and tasks require operator review.

## Docker

The runner uses a preexisting operator-selected Linux image, no network, a read-only root and workspace mount, UID/GID 65534, all capabilities dropped, no-new-privileges, one CPU, 512 MB memory/swap ceiling, 64 PIDs, and a small temporary filesystem. It does not mount credentials, host home directories, or the Docker socket. The host controller alone invokes Docker. Timeouts force-remove the named container, including when the Docker client is killed.

See [Docker's run reference](https://docs.docker.com/reference/cli/docker/container/run/) for the underlying options. An image ID is captured for provenance. Pin the image digest for experiments. The default tag is a convenient development image, not an immutable environment specification.

Build dependencies into a task-specific image in a separate, operator-reviewed preparation step. Network is unavailable during tests. Read-only source means tests that write to the repository need adaptation or a future disposable writable-copy implementation; do not weaken mounts silently. The default image supports the standard-library fixture only.

Docker is defense in depth, not a guarantee against kernel or runtime vulnerabilities. Stronger isolation is future work for adversarial repositories. Grading tests execute in the same process environment as candidate imports and are not tamper-proof.

## Local execution

Local execution is host execution, even though files are in a separate folder and the child receives a minimized environment. It is permitted only through explicit `--backend local --allow-local`, except the `demo` command which only runs the bundled trusted fixture. The tests also use local execution for trusted code. There is no automatic fallback.

## Current bounds and exclusions

Snapshots are limited to 32 MB and individual files to 256 KB. Symlinks, submodules, special files and large repositories are unsupported. Agent reads, searches, logs and model responses are bounded individually. Logs can still contain private source. No automatic secret-redaction claim is made.

Repository archive preparation has a timeout; the agent loop and every test process have their own limits. File inspection and cleanup add overhead. These limits are operational controls for a prototype, not hard real-time scheduling.

The harness supports local Git commits with operator-supplied tests. It does not clone remote repositories, provision arbitrary dependencies, or translate SWE-bench manifests. Those require additional reviewed adapters.
