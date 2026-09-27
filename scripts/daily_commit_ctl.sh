#!/usr/bin/env bash
# ==============================================================================
# Control utility for the Daily Single-Commit System
# Usage: ./scripts/daily_commit_ctl.sh [status|run|install|uninstall|logs]
# ==============================================================================

set -euo pipefail

REPO_DIR="/Users/aliiskandarli/Downloads/tubitak-project"
SCRIPT_PATH="$REPO_DIR/scripts/daily_commit.sh"
LOG_FILE="$REPO_DIR/.git/daily_commit.log"
STAMP_FILE="$HOME/.tubitak_last_commit_date"
ZSHRC_FILE="$HOME/.zshrc"
MARKER_START="# >>> tubitak-daily-commit >>>"
MARKER_END="# <<< tubitak-daily-commit <<<"

ACTION="${1:-status}"

case "$ACTION" in
    status)
        TODAY="$(date '+%Y-%m-%d')"
        LAST_DATE="$(git -C "$REPO_DIR" log -1 --format='%ad' --date=short 2>/dev/null || echo 'none')"
        LAST_COMMIT="$(git -C "$REPO_DIR" log -1 --oneline 2>/dev/null || echo 'none')"

        echo "========================================================"
        echo "  Daily Single-Commit System Status"
        echo "========================================================"
        echo "  Today's Date      : $TODAY"
        echo "  Last Commit Date  : $LAST_DATE"
        echo "  Latest Commit     : $LAST_COMMIT"
        if [ "$LAST_DATE" = "$TODAY" ]; then
            echo "  Today's Quota     : [COMPLETED] (1/1 commit made today)"
        else
            echo "  Today's Quota     : [PENDING]   (0/1 commit made today)"
        fi

        if grep -q "$MARKER_START" "$ZSHRC_FILE" 2>/dev/null; then
            echo "  Auto-Trigger Hook : ACTIVE (in ~/.zshrc + Antigravity Cron)"
        else
            echo "  Auto-Trigger Hook : NOT INSTALLED"
        fi
        echo "========================================================"
        ;;

    run)
        bash "$SCRIPT_PATH"
        ;;

    install)
        # Remove old launchd plist if present (macOS TCC blocks background agents on ~/Downloads)
        OLD_PLIST="$HOME/Library/LaunchAgents/com.ali0lo.tubitak.dailycommit.plist"
        if [ -f "$OLD_PLIST" ]; then
            launchctl unload "$OLD_PLIST" 2>/dev/null || true
            rm -f "$OLD_PLIST"
        fi

        touch "$ZSHRC_FILE"
        if ! grep -q "$MARKER_START" "$ZSHRC_FILE" 2>/dev/null; then
            cat << EOF >> "$ZSHRC_FILE"

$MARKER_START
if [[ "\$(cat "\$HOME/.tubitak_last_commit_date" 2>/dev/null)" != "\$(date '+%Y-%m-%d')" ]]; then
    (bash "$SCRIPT_PATH" >/dev/null 2>&1 &)
fi
$MARKER_END
EOF
            echo "Installed automatic daily check into $ZSHRC_FILE"
        else
            echo "Automatic daily check is already installed in $ZSHRC_FILE"
        fi
        ;;

    uninstall)
        if [ -f "$ZSHRC_FILE" ] && grep -q "$MARKER_START" "$ZSHRC_FILE"; then
            sed -i.bak "/$MARKER_START/,/$MARKER_END/d" "$ZSHRC_FILE"
            rm -f "${ZSHRC_FILE}.bak"
            echo "Removed automatic daily check from $ZSHRC_FILE"
        else
            echo "Automatic daily check was not found in $ZSHRC_FILE"
        fi
        ;;

    logs)
        if [ -f "$LOG_FILE" ]; then
            tail -n 30 "$LOG_FILE"
        else
            echo "No logs found yet at $LOG_FILE"
        fi
        ;;

    *)
        echo "Usage: $0 {status|run|install|uninstall|logs}"
        exit 1
        ;;
esac
