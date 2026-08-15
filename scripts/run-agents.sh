#!/usr/bin/env bash
# Run SetuHire agent briefs (docs/agents) wave-by-wave via `opencode run`.
#
# Usage:
#   ./scripts/run-agents.sh            # all waves: 0 -> 1 -> 2 (07 before 08-10)
#   ./scripts/run-agents.sh 0          # wave 0 only (backend foundation, run alone)
#   ./scripts/run-agents.sh 1          # wave 1: 6 backend agents in parallel
#   ./scripts/run-agents.sh 2          # wave 2: web foundation, then 3 page agents
#   ./scripts/run-agents.sh 03-be-jobs # run a single agent by brief name
#   ./scripts/run-agents.sh --status   # show what's currently running (local + server sessions)
#   ./scripts/run-agents.sh --log 03   # tail latest log for an agent
#   ./scripts/run-agents.sh --watch    # tail ALL agent logs live
#
# All agent runs attach to the `opencode serve` server on $SERVER so you can
# watch any of them live from one terminal:
#   opencode attach $SERVER --session <id>
# Override the server with:  OPENCODE_SERVER_URL=http://other:4096 ./scripts/run-agents.sh 1
#
# Logs: logs/<brief>.out (final report) | logs/<brief>.err (debug) | logs/<brief>.pid
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOCS="$ROOT/docs/agents"
LOGS="$ROOT/logs"
mkdir -p "$LOGS"

SERVER="${OPENCODE_SERVER_URL:-http://127.0.0.1:4096}"

server_alive() {
  curl -s -m 3 -o /dev/null "$SERVER/session" 2>/dev/null
}

ATTACH_FLAG=()
if server_alive; then
  ATTACH_FLAG=(--attach "$SERVER")
  echo "● attaching agent runs to $SERVER"
else
  echo "⚠  $SERVER not reachable — running agents WITHOUT a server (use: opencode serve)"
fi

WAVE0=("00-be-foundation")
WAVE1=("01-be-auth" "02-be-clients-vendors" "03-be-jobs" "04-be-candidates" "05-be-pipeline" "06-be-ai-service")
WAVE2A=("07-web-foundation")
WAVE2B=("08-web-clients-vendors" "09-web-jobs-candidates" "10-web-pipeline-finance")

# Resolve a wave/group/single arg into a list of brief filenames (without .md)
resolve() {
  case "$1" in
    0) echo "${WAVE0[@]}" ;;
    1) echo "${WAVE1[@]}" ;;
    2) echo "${WAVE2A[@]}" ;;
    2a) echo "${WAVE2A[@]}" ;;
    2b) echo "${WAVE2B[@]}" ;;
    *)
      local brief="$1"
      [[ "$brief" != *.md ]] && brief="$brief.md"
      if [ -f "$DOCS/$brief" ]; then
        echo "${brief%.md}"
      else
        echo "error: no agent brief '$1' (expected 0 | 1 | 2 | 2a | 2b | a brief name)" >&2
        return 1
      fi
      ;;
  esac
}

AGENT_PROMPT='You are implementing SetuHire per your brief. First read %s fully and follow it exactly: touch ONLY the files your brief lists, keep the shared/app.ts router untouched unless your brief says so. Implement everything, then run pnpm typecheck in the relevant package and fix all errors. End with a report: files changed + verification evidence.'

run_agent() {
  local brief="$1"
  local out="$LOGS/$brief.out" err="$LOGS/$brief.err"
  : > "$out"; : > "$err"
  echo "  ▶ $brief"
  (
    opencode run "${ATTACH_FLAG[@]}" --title "$brief" --print-logs \
      "$(printf "$AGENT_PROMPT" "$DOCS/$brief.md")" \
      > "$out" 2> "$err"
  ) &
  echo $! > "$LOGS/$brief.pid"
}

status_line() {
  local briefs=("$@")
  local line=""
  for b in "${briefs[@]}"; do
    local pid; pid="$(cat "$LOGS/$b.pid" 2>/dev/null || echo 0)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      line="$line $b[running]"
    else
      line="$line $b[done]"
    fi
  done
  echo "$line"
}

wait_wave() {
  local briefs=("$@")
  echo "  waiting:$(status_line "${briefs[@]}")"
  local remaining="${#briefs[@]}"
  local prev=""
  while [ "$remaining" -gt 0 ]; do
    sleep 3
    remaining=0
    local line=""
    for b in "${briefs[@]}"; do
      local pid; pid="$(cat "$LOGS/$b.pid" 2>/dev/null || echo 0)"
      if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        line="$line $b[running]"
        remaining=$((remaining + 1))
      else
        line="$line $b[done]"
      fi
    done
    if [ "$line" != "$prev" ]; then
      echo "  status:$line"
      prev="$line"
    fi
  done
}

report() {
  local briefs=("$@")
  for b in "${briefs[@]}"; do
    local pid; pid="$(cat "$LOGS/$b.pid" 2>/dev/null || echo 0)"
    local code="?"
    if [ -n "$pid" ] && [ "$pid" != "0" ]; then
      wait "$pid" 2>/dev/null
      code=$?
    fi
    echo ""
    echo "════════ $b  (exit $code) ════════"
    tail -n 25 "$LOGS/$b.out" 2>/dev/null
    echo "  more: logs/$b.out | debug: logs/$b.err"
  done
}

# ---- commands -------------------------------------------------------------
if [ "${1:-}" = "--status" ]; then
  echo "local agent runs:"
  local_any=0
  for pidfile in "$LOGS"/*.pid; do
    [ -f "$pidfile" ] || continue
    local_any=1
    b=$(basename "$pidfile" .pid)
    pid="$(cat "$pidfile")"
    if kill -0 "$pid" 2>/dev/null; then
      echo "  $b  (pid $pid, RUNNING)"
    else
      echo "  $b  (pid $pid, finished)"
    fi
  done
  [ "$local_any" -eq 0 ] && echo "  (none)"
  echo "server sessions on $SERVER:"
  if server_alive; then
    curl -s "$SERVER/session" | python3 -c '
import json,sys
for s in json.load(sys.stdin):
    print("  %s  %s  cost=%.2f  updated=%s" % (s.get("id","")[:8], s.get("title","")[:50], s.get("cost",0), s.get("time",{}).get("updated","")))
' 2>/dev/null || curl -s "$SERVER/session" | head -c 400
  else
    echo "  (server not reachable)"
  fi
  exit 0
fi

if [ "${1:-}" = "--log" ]; then
  brief="$2"
  f="$LOGS/${brief%.md}.out"
  [ -f "$f" ] || { echo "no log for '$2' yet"; exit 1; }
  echo "== tail $f =="
  tail -f "$f"
  exit 0
fi

if [ "${1:-}" = "--watch" ]; then
  echo "tailing all agent logs (ctrl-c to stop). To watch live sessions: opencode attach $SERVER"
  for f in "$LOGS"/*.out; do
    [ -f "$f" ] || continue
    tail -F "$f" &
  done
  wait
  exit 0
fi

# ---- wave orchestration ---------------------------------------------------
WAVES=()
if [ "$#" -eq 0 ]; then
  WAVES=(0 1 2)
else
  for arg in "$@"; do
    case "$arg" in
      0|1|2a|2b) WAVES+=("$arg") ;;
      2) WAVES+=(2a 2b) ;;
      *) WAVES+=("$arg") ;;   # single brief name
    esac
  done
fi

for w in "${WAVES[@]}"; do
  briefs=($(resolve "$w")) || exit 1
  echo ""
  echo "################ WAVE: $w (${briefs[*]}) ################"
  for b in "${briefs[@]}"; do
    run_agent "$b"
  done
  wait_wave "${briefs[@]}"
  report "${briefs[@]}"
done

echo ""
echo "ALL DONE."
echo "  status:      ./scripts/run-agents.sh --status"
echo "  watch logs:  ./scripts/run-agents.sh --watch"
echo "  jump into a live agent session:  opencode attach $SERVER --session <id>"
echo "  logs:        $LOGS"
