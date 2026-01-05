#!/bin/bash
# Setup branch protection rules for Aviation Missions App

set -e

REPO="jordanhubbard/aviation-missions-app"
BRANCH="${1:-main}"

echo "🔒 Setting up branch protection for $BRANCH branch..."

# Check if gh CLI is authenticated
if ! gh auth status >/dev/null 2>&1; then
    echo "❌ Error: GitHub CLI is not authenticated"
    echo "Please run: gh auth login"
    exit 1
fi

# Enable branch protection
echo "📋 Configuring branch protection rules..."

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "/repos/$REPO/branches/$BRANCH/protection" \
  -f required_status_checks[strict]=true \
  -f 'required_status_checks[contexts][]=lint' \
  -f 'required_status_checks[contexts][]=test-backend' \
  -f 'required_status_checks[contexts][]=build' \
  -f 'required_status_checks[contexts][]=security' \
  -f 'required_status_checks[contexts][]=integration-test' \
  -f required_pull_request_reviews[required_approving_review_count]=1 \
  -f required_pull_request_reviews[dismiss_stale_reviews]=true \
  -f required_pull_request_reviews[require_code_owner_reviews]=false \
  -f enforce_admins=true \
  -f required_linear_history=false \
  -f allow_force_pushes=false \
  -f allow_deletions=false \
  -f required_conversation_resolution=true \
  -f lock_branch=false \
  -f allow_fork_syncing=true

echo "✅ Branch protection enabled for $BRANCH"
echo ""
echo "Configured settings:"
echo "  - Require status checks to pass"
echo "  - Require 1 pull request review"
echo "  - Dismiss stale reviews"
echo "  - Require conversation resolution"
echo "  - Enforce for administrators"
echo "  - Block force pushes"
echo "  - Block deletions"
echo ""
echo "Required status checks:"
echo "  - lint"
echo "  - test-backend"
echo "  - build"
echo "  - security"
echo "  - integration-test"
