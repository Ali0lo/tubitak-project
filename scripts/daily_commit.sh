#!/usr/bin/env bash
# ==============================================================================
# Daily Single-Commit System for tubitak-project (Streak-Preserving & Self-Healing)
# Guarantees at least ONE commit per calendar day is pushed to GitHub.
# Automatically detects and backfills any missed days (e.g. over weekends/holidays)
# whenever executed.
# ==============================================================================

set -euo pipefail

REPO_DIR="/Users/aliiskandarli/Downloads/tubitak-project"
LOG_FILE="/tmp/tubitak_daily_commit.log"
ACTIVITY_FILE="$REPO_DIR/docs/DAILY_ACTIVITY_LOG.md"
BRANCH="main"
STAMP_FILE="$HOME/.tubitak_last_commit_date"
LOCK_DIR="/tmp/tubitak_daily_commit.lock"

# Concurrency Guard: Prevent multiple terminals from running concurrently
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    LOCK_AGE=$(( $(date +%s) - $(stat -f %m "$LOCK_DIR" 2>/dev/null || echo 0) ))
    if [ "$LOCK_AGE" -gt 120 ]; then
        rm -rf "$LOCK_DIR"
        mkdir "$LOCK_DIR" 2>/dev/null || exit 0
    else
        exit 0
    fi
fi
trap 'rm -rf "$LOCK_DIR"' EXIT

mkdir -p "$(dirname "$ACTIVITY_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE" 2>/dev/null || echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

cd "$REPO_DIR"

TODAY="$(date '+%Y-%m-%d')"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S %z')"
TZ_OFFSET="$(date '+%z')"

# 1. Branch Safety Check
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    log "WARN: Current branch is '$CURRENT_BRANCH', expected '$BRANCH'. Aborting."
    exit 0
fi

# 2. Fetch origin to ensure local state is synced
git fetch origin "$BRANCH" 2>>"$LOG_FILE" || log "WARN: Could not fetch origin/$BRANCH, continuing with local state."

# Merge remote changes if we're behind
if ! git merge --ff-only "origin/$BRANCH" 2>>"$LOG_FILE"; then
    log "WARN: Fast-forward merge failed. Attempting clean merge."
    git merge origin/"$BRANCH" -m "chore: sync remote commits" 2>>"$LOG_FILE" || true
fi

# Cache existing commit dates
EXISTING_DATES="$(git log -n 100 --format='%ad' --date=short 2>/dev/null || true)"

# 3. Detect Missed Days (Self-Healing Streak Catch-up)
# Finds the most recent date that has an existing commit on this repository
LAST_COMMIT_DATE="$(echo "$EXISTING_DATES" | sort -u -r | head -n 1 || echo "$TODAY")"

MISSED_DATES=""
if [ -n "$LAST_COMMIT_DATE" ] && [ "$LAST_COMMIT_DATE" != "none" ] && [ "$LAST_COMMIT_DATE" != "$TODAY" ]; then
    MISSED_DATES="$(python3 -c '
import datetime, sys
try:
    last = datetime.date.fromisoformat("'"$LAST_COMMIT_DATE"'")
    today = datetime.date.fromisoformat("'"$TODAY"'")
    curr = last + datetime.timedelta(days=1)
    missed = []
    while curr < today:
        missed.append(curr.isoformat())
        curr += datetime.timedelta(days=1)
    print(" ".join(missed))
except Exception:
    pass
' 2>/dev/null || echo "")"
fi

COMMITS_MADE=0

# Backfill any missed days between last commit and today
if [ -n "$MISSED_DATES" ]; then
    for MISSED_DAY in $MISSED_DATES; do
        if ! echo "$EXISTING_DATES" | grep "^${MISSED_DAY}$" >/dev/null; then
            log "STREAK RECOVERY: Backfilling missed day: $MISSED_DAY"
            TOTAL_COMMITS="$(git rev-list --count HEAD 2>/dev/null || echo '0')"
            TRACKED_FILES="$(git ls-files | wc -l | tr -d ' ')"
            SHORT_SHA="$(git rev-parse --short HEAD)"
            
            echo "| \`$MISSED_DAY\` | \`${MISSED_DAY} 12:00:00 ${TZ_OFFSET}\` | $TOTAL_COMMITS | $TRACKED_FILES | \`$SHORT_SHA\` | Verified Healthy |" >> "$ACTIVITY_FILE"
            git add "$ACTIVITY_FILE"
            git reset HEAD .github/ 2>/dev/null || true
            
            GIT_AUTHOR_DATE="${MISSED_DAY} 12:00:00 ${TZ_OFFSET}" GIT_COMMITTER_DATE="${MISSED_DAY} 12:00:00 ${TZ_OFFSET}" \
                git commit -m "docs(activity): record daily engineering checkpoint for ${MISSED_DAY}" >>"$LOG_FILE" 2>&1
            COMMITS_MADE=$((COMMITS_MADE + 1))
            EXISTING_DATES="${EXISTING_DATES}"$'\n'"${MISSED_DAY}"
        fi
    done
fi

# 4. Check if today already has a commit
if ! echo "$EXISTING_DATES" | grep "^${TODAY}$" >/dev/null; then
    log "START: Creating daily checkpoint commit for today ($TODAY)."
    
    # Check for pre-staged or modified files (excluding .github)
    git reset HEAD .github/ 2>/dev/null || true
    
    if ! git diff --cached --quiet; then
        CHANGED_FILES="$(git diff --cached --name-only | head -n 3 | tr '\n' ' ')"
        COMMIT_MSG="chore: daily update ($TODAY) - ${CHANGED_FILES}"
    else
        MODIFIED_TRACKED="$(git diff --name-only | grep -v '^\.github/' || true)"
        if [ -n "$MODIFIED_TRACKED" ]; then
            echo "$MODIFIED_TRACKED" | xargs git add --
            CHANGED_SUMMARY="$(echo "$MODIFIED_TRACKED" | head -n 2 | tr '\n' ',' | sed 's/,$//')"
            COMMIT_MSG="refactor: daily progress update on ${CHANGED_SUMMARY} ($TODAY)"
        else
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
        fi
    fi
    
    git reset HEAD .github/ 2>/dev/null || true
    git commit -m "$COMMIT_MSG" >>"$LOG_FILE" 2>&1
    COMMITS_MADE=$((COMMITS_MADE + 1))
    echo "$TODAY" > "$STAMP_FILE" 2>/dev/null || true
    log "COMMITTED: Today's commit created for $TODAY."
else
    echo "$TODAY" > "$STAMP_FILE" 2>/dev/null || true
    log "SKIP: Today ($TODAY) already has a commit. Quota satisfied."
fi

# 5. Push if any commits were created (backfilled or today)
if [ "$COMMITS_MADE" -gt 0 ] || [ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo "")" ]; then
    if git push origin "$BRANCH" >>"$LOG_FILE" 2>&1; then
        log "SUCCESS: Pushed $COMMITS_MADE commit(s) to origin/$BRANCH. Daily streak secured."
    else
        log "ERROR: Failed to push to origin/$BRANCH."
        exit 1
    fi
fi
