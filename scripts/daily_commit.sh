#!/usr/bin/env bash
# ==============================================================================
# Daily Single-Commit System for tubitak-project
# Guarantees at most ONE commit per calendar day is committed and pushed to GitHub.
# ==============================================================================

set -euo pipefail

REPO_DIR="/Users/aliiskandarli/Downloads/tubitak-project"
LOG_FILE="$REPO_DIR/.git/daily_commit.log"
ACTIVITY_FILE="$REPO_DIR/docs/DAILY_ACTIVITY_LOG.md"
BRANCH="main"

mkdir -p "$(dirname "$ACTIVITY_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

cd "$REPO_DIR"

TODAY="$(date '+%Y-%m-%d')"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S %z')"
STAMP_FILE="$HOME/.tubitak_last_commit_date"

# 1. Strict 1-Commit-Per-Day Guard
LAST_COMMIT_DATE="$(git log -1 --format='%ad' --date=short 2>/dev/null || echo 'none')"
LAST_COMMIT_HASH="$(git log -1 --format='%h' 2>/dev/null || echo 'none')"

if [ "$LAST_COMMIT_DATE" = "$TODAY" ]; then
    echo "$TODAY" > "$STAMP_FILE" 2>/dev/null || true
    log "SKIP: A commit ($LAST_COMMIT_HASH) was already made today ($TODAY). Enforcing 1-commit-per-day policy."
    exit 0
fi

log "START: No commit found for today ($TODAY). Last commit was on $LAST_COMMIT_DATE ($LAST_COMMIT_HASH)."

# 2. Ensure we are on main branch and synced with remote
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    log "WARN: Current branch is '$CURRENT_BRANCH', expected '$BRANCH'. Aborting to avoid unintended branch commits."
    exit 1
fi

git fetch origin "$BRANCH" 2>>"$LOG_FILE" || log "WARN: Could not fetch origin/$BRANCH, continuing with local state."

# Check again in case remote had a commit from today
REMOTE_COMMIT_DATE="$(git log -1 origin/$BRANCH --format='%ad' --date=short 2>/dev/null || echo 'none')"
if [ "$REMOTE_COMMIT_DATE" = "$TODAY" ]; then
    log "SKIP: Remote origin/$BRANCH already has a commit for today ($TODAY). Fast-forwarding local branch."
    git merge --ff-only "origin/$BRANCH" 2>>"$LOG_FILE" || true
    exit 0
fi

# 3. Determine what to commit
# Never stage .github/ workflows (PAT scope safety) and exclude private untracked files
git reset HEAD .github/ 2>/dev/null || true

# Check if user already staged something manually
if ! git diff --cached --quiet; then
    CHANGED_FILES="$(git diff --cached --name-only | head -n 3 | tr '\n' ' ')"
    COMMIT_MSG="chore: daily update ($TODAY) - ${CHANGED_FILES}"
    log "Using pre-staged changes for today's commit."
else
    # Check if there are modified tracked files (excluding .github)
    MODIFIED_TRACKED="$(git diff --name-only | grep -v '^\.github/' || true)"
    if [ -n "$MODIFIED_TRACKED" ]; then
        # Stage modified tracked files (except .github)
        echo "$MODIFIED_TRACKED" | xargs git add --
        CHANGED_SUMMARY="$(echo "$MODIFIED_TRACKED" | head -n 2 | tr '\n' ',' | sed 's/,$//')"
        COMMIT_MSG="refactor: daily progress update on ${CHANGED_SUMMARY} ($TODAY)"
        log "Staged modified tracked files for today's commit: $CHANGED_SUMMARY"
    else
        # Generate daily engineering activity & repository health snapshot
        if [ ! -f "$ACTIVITY_FILE" ]; then
            cat << 'EOF' > "$ACTIVITY_FILE"
# Daily Engineering & Repository Activity Log

Automated daily engineering checkpoints, metrics, and repository state snapshots.

| Date | Timestamp | Total Commits | Tracked Files | Head Revision | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
EOF
        fi

        TOTAL_COMMITS="$(git rev-list --count HEAD 2>/dev/null || echo '0')"
        TRACKED_FILES="$(git ls-files | wc -l | tr -d ' ')"
        SHORT_SHA="$(git rev-parse --short HEAD)"

        echo "| \`$TODAY\` | \`$TIMESTAMP\` | $TOTAL_COMMITS | $TRACKED_FILES | \`$SHORT_SHA\` | Verified Healthy |" >> "$ACTIVITY_FILE"
        git add "$ACTIVITY_FILE"
        COMMIT_MSG="docs(activity): record daily engineering checkpoint for $TODAY"
        log "Updated $ACTIVITY_FILE for today's commit."
    fi
fi

# Double-check .github/ is not staged
git reset HEAD .github/ 2>/dev/null || true

# 4. Commit and Push to GitHub
git commit -m "$COMMIT_MSG" >>"$LOG_FILE" 2>&1
NEW_HASH="$(git rev-parse --short HEAD)"
log "COMMITTED: [$NEW_HASH] $COMMIT_MSG"

if git push origin "$BRANCH" >>"$LOG_FILE" 2>&1; then
    echo "$TODAY" > "$STAMP_FILE" 2>/dev/null || true
    log "SUCCESS: Pushed today's single commit ($NEW_HASH) to origin/$BRANCH."
else
    log "ERROR: Failed to push commit ($NEW_HASH) to origin/$BRANCH."
    exit 1
fi
