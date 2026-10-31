---
name: checkout-git-repository
description: Materialize a Git repository for build or test work with shallow exact-revision history by default, recursive submodules, repository-local Git LFS setup and hydration, and fail-closed content verification. Use when cloning or refreshing a worker checkout, preparing a repository with unknown submodule or LFS requirements, or diagnosing unresolved LFS pointers after checkout.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Check out a Git repository

Run the detect-before-install skill's sample-worker profile first. Git and Git LFS are
one required source-control baseline on Linux, macOS, and Windows; an installed
`git-lfs` executable alone does not prove that a checkout is hydrated.

For a new build/test workspace, run:

```text
python skills/agent/checkout-git-repository/scripts/checkout.py URL REVISION DESTINATION
```

The command fetches the exact requested revision at depth one, verifies the resulting
commit and tree, initializes recursive submodules at bounded depth, configures Git LFS
locally in the root and every nested repository, pulls their selected LFS objects, and
rejects unresolved current-tree LFS pointers, incomplete submodules, or a dirty result.
Preserve its JSON report with worker evidence.

Use `--history-depth COMMITS` only when the requested operation names a bounded ancestry
requirement. Use `--full-history` only for an explicitly history-sensitive job; ordinary
build and test work does not justify it. Do not replace checkout with file-copy transport,
and do not silently continue after a submodule, authentication, network, or LFS failure.

This skill owns ordinary repository materialization. Parent contribution custody remains
`litai project parent checkout`, and Standard worker source identity remains governed by
the worker execution contract.
