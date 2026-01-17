#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

ensure_clean_worktree() {
  if [ -n "$(git status --porcelain)" ]; then
    echo "Working tree is dirty. Commit or stash changes before releasing." >&2
    exit 1
  fi
}

latest_tag=$(git tag --list "v*" | sort -V | tail -n 1 || true)

increment_tag() {
  local raw=${1#v}
  local major
  local minor
  local patch

  IFS='.' read -r major minor patch <<< "$raw"
  major=${major:-0}
  minor=${minor:-1}
  patch=${patch:-0}
  patch=$((patch + 1))

  echo "v${major}.${minor}.${patch}"
}

if [ -n "$latest_tag" ]; then
  base_ref="$latest_tag"
  next_tag=$(increment_tag "$latest_tag")
  range="${latest_tag}..HEAD"
else
  base_ref=$(git rev-list --max-parents=0 HEAD)
  next_tag="v0.1.0"
  range=""
fi

echo "Latest tag: ${latest_tag:-none}"
echo "Next tag: ${next_tag}"

ensure_clean_worktree

echo "Running release validations..."
.venv/bin/python validate_beads.py
./scripts/check-all-contrast.sh
make lint
npm run type-check --workspaces --if-present
make test

release_date=$(date +%Y-%m-%d)
if [ -n "$range" ]; then
  release_notes=$(git log "$range" --pretty=format:'- %s')
else
  release_notes=$(git log --pretty=format:'- %s')
fi

if [ -z "$release_notes" ]; then
  release_notes="- No changes."
fi

entry="## ${next_tag} - ${release_date}\n\n${release_notes}\n"
changelog_path="CHANGELOG.md"

if [ -f "$changelog_path" ]; then
  if grep -q "^## ${next_tag}\b" "$changelog_path"; then
    echo "CHANGELOG already contains entry for ${next_tag}." >&2
    exit 1
  fi
  first_line=$(head -n 1 "$changelog_path" || true)
  tmpfile=$(mktemp)
  if [ "$first_line" = "# Changelog" ]; then
    printf "%s\n\n" "$first_line" > "$tmpfile"
    printf "%b\n" "$entry" >> "$tmpfile"
    tail -n +2 "$changelog_path" >> "$tmpfile"
  else
    printf "# Changelog\n\n" > "$tmpfile"
    printf "%b\n" "$entry" >> "$tmpfile"
    cat "$changelog_path" >> "$tmpfile"
  fi
  mv "$tmpfile" "$changelog_path"
else
  printf "# Changelog\n\n" > "$changelog_path"
  printf "%b\n" "$entry" >> "$changelog_path"
fi

git add "$changelog_path"
git commit -m "chore(release): ${next_tag}"
git tag -a "$next_tag" -m "Release ${next_tag}"

git push origin HEAD
git push origin "$next_tag"

head_sha=$(git rev-parse HEAD)
run_id=""
for _ in $(seq 1 30); do
  run_id=$(gh run list --branch main --limit 20 --json databaseId,headSha --jq ".[] | select(.headSha==\"${head_sha}\") | .databaseId" | head -n 1)
  if [ -n "$run_id" ]; then
    break
  fi
  sleep 10
done

if [ -z "$run_id" ]; then
  echo "No GitHub Actions run found for ${head_sha}." >&2
  exit 1
fi

if ! gh run watch "$run_id" --exit-status; then
  echo "CI failed. Deleting tag ${next_tag}." >&2
  git tag -d "$next_tag" || true
  git push origin ":refs/tags/${next_tag}" || true
  exit 1
fi

notes_file=$(mktemp)
printf "## ${next_tag}\n\n%b\n" "$release_notes" > "$notes_file"
gh release create "$next_tag" --title "$next_tag" --notes-file "$notes_file"
rm -f "$notes_file"

echo "Release ${next_tag} created successfully."
