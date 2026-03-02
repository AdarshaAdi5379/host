#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${BACKEND_DIR}/logs"
LOG_FILE="${LOG_DIR}/gateway_worker.log"
PID_FILE="${BACKEND_DIR}/.gateway_worker.pid"
PYTHON_BIN="${PYTHON_BIN:-$(command -v python3 || command -v python)}"

if [[ -z "${PYTHON_BIN}" ]]; then
  echo "[error] Could not find python3 or python in PATH." >&2
  exit 1
fi

start_worker() {
  mkdir -p "${LOG_DIR}"

  if [[ -f "${PID_FILE}" ]]; then
    local pid
    pid="$(cat "${PID_FILE}")"
    if [[ -n "${pid}" ]] && kill -0 "${pid}" >/dev/null 2>&1; then
      echo "[info] Gateway worker already running (pid=${pid})"
      exit 0
    fi
    rm -f "${PID_FILE}"
  fi

  cd "${BACKEND_DIR}"
  nohup "${PYTHON_BIN}" manage.py run_gateway_worker --sleep-seconds 1 >> "${LOG_FILE}" 2>&1 &
  local pid=$!
  echo "${pid}" > "${PID_FILE}"
  echo "[ok] Gateway worker started (pid=${pid})"
  echo "[info] Logs: tail -f ${LOG_FILE}"
}

stop_worker() {
  if [[ ! -f "${PID_FILE}" ]]; then
    echo "[info] Gateway worker is not running (no pid file)."
    exit 0
  fi

  local pid
  pid="$(cat "${PID_FILE}")"
  if [[ -z "${pid}" ]]; then
    rm -f "${PID_FILE}"
    echo "[info] Removed empty pid file."
    exit 0
  fi

  if kill -0 "${pid}" >/dev/null 2>&1; then
    kill "${pid}"
    echo "[ok] Stopped gateway worker (pid=${pid})"
  else
    echo "[info] Process ${pid} not running; cleaning stale pid file."
  fi
  rm -f "${PID_FILE}"
}

status_worker() {
  if [[ -f "${PID_FILE}" ]]; then
    local pid
    pid="$(cat "${PID_FILE}")"
    if [[ -n "${pid}" ]] && kill -0 "${pid}" >/dev/null 2>&1; then
      echo "running (pid=${pid})"
      exit 0
    fi
    echo "stopped (stale pid file)"
    exit 1
  fi

  echo "stopped"
  exit 1
}

case "${1:-}" in
  start)
    start_worker
    ;;
  stop)
    stop_worker
    ;;
  restart)
    stop_worker || true
    start_worker
    ;;
  status)
    status_worker
    ;;
  logs)
    mkdir -p "${LOG_DIR}"
    touch "${LOG_FILE}"
    tail -f "${LOG_FILE}"
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs}" >&2
    exit 1
    ;;
esac
