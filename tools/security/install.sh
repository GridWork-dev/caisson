#!/usr/bin/env bash
# Idempotent install of the Caisson security toolchain onto this box (Linux amd64). Everything
# lands in ~/.local/bin or a uv tool (no sudo). Re-running skips already-present tools.
#
# Versions are pinned where a supply-chain incident or breaking flag change makes "latest" risky
# (notably Trivy — the 2026-03 GHSA-69fq-xp46-6x23 credential-theft release wave).
set -uo pipefail
export PATH="$HOME/.local/bin:$PATH"
BIN="$HOME/.local/bin"; mkdir -p "$BIN"
TRIVY_V="v0.72.0"; TRUFFLEHOG_V="v3.95.9"; PTAI_V="0.17.2"
HEXSTRIKE_DIR="${HEXSTRIKE_DIR:-$HOME/lab/tools/hexstrike-ai}"

info() { printf '\033[1m» %s\033[0m\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }
gh_latest_tag() { curl -fsSL "https://api.github.com/repos/$1/releases/latest" | grep -oP '"tag_name":\s*"\K[^"]+'; }

# 1 — uv-managed Python CLIs (semgrep, schemathesis, ruff, ptai) --------------------------------
have uv || { echo "uv required (https://docs.astral.sh/uv) — install it first"; exit 1; }
for pkg in semgrep schemathesis ruff; do
  have "$pkg" && { info "$pkg present ($($pkg --version 2>&1 | head -1))"; } || { info "installing $pkg"; uv tool install "$pkg"; }
done
have ptai && info "ptai present" || { info "installing ptai==$PTAI_V"; uv tool install "ptai==$PTAI_V" || uv tool install ptai; }

# 2 — Trivy (PINNED — supply-chain incident) ----------------------------------------------------
if have trivy; then info "trivy present ($(trivy --version 2>/dev/null | head -1))"; else
  info "installing trivy $TRIVY_V"
  curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b "$BIN" "$TRIVY_V"
fi

# 3 — TruffleHog (pinned) -----------------------------------------------------------------------
if have trufflehog; then info "trufflehog present ($(trufflehog --version 2>&1 | head -1))"; else
  info "installing trufflehog $TRUFFLEHOG_V"
  curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh | sh -s -- -b "$BIN" "$TRUFFLEHOG_V"
fi

# 4 — osv-scanner (latest binary) ---------------------------------------------------------------
if have osv-scanner; then info "osv-scanner present"; else
  info "installing osv-scanner"
  curl -sSL -o "$BIN/osv-scanner" "https://github.com/google/osv-scanner/releases/latest/download/osv-scanner_linux_amd64" && chmod +x "$BIN/osv-scanner"
fi

# 5 — Nuclei (latest release zip) ---------------------------------------------------------------
if have nuclei; then info "nuclei present ($(nuclei -version 2>&1 | tail -1))"; else
  info "installing nuclei"
  ntag="$(gh_latest_tag projectdiscovery/nuclei)"; nver="${ntag#v}"
  tmp="$(mktemp -d)"; curl -sSL -o "$tmp/n.zip" "https://github.com/projectdiscovery/nuclei/releases/download/${ntag}/nuclei_${nver}_linux_amd64.zip" \
    && ( cd "$tmp" && unzip -oq n.zip && install -m755 nuclei "$BIN/nuclei" ); rm -rf "$tmp"
fi

# 6 — OWASP ZAP (Docker image) ------------------------------------------------------------------
if have docker; then info "pulling ZAP image"; docker pull ghcr.io/zaproxy/zaproxy:stable >/dev/null 2>&1 && info "ZAP image ready" || info "ZAP pull failed (pull manually when needed)"; else
  info "docker absent — ZAP DAST runs via docker; install docker to use it"; fi

# 7 — HexStrike AI (framework + Python deps; offensive binaries best-effort below) --------------
if [[ -d "$HEXSTRIKE_DIR/.git" ]]; then
  info "HexStrike present at $HEXSTRIKE_DIR (git pull)"; git -C "$HEXSTRIKE_DIR" pull --ff-only >/dev/null 2>&1 || true
else
  info "cloning HexStrike → $HEXSTRIKE_DIR"; mkdir -p "$(dirname "$HEXSTRIKE_DIR")"
  git clone --depth 1 https://github.com/0x4m4/hexstrike-ai.git "$HEXSTRIKE_DIR"
fi
if [[ -d "$HEXSTRIKE_DIR" ]]; then
  info "HexStrike python venv + deps"
  ( cd "$HEXSTRIKE_DIR" && uv venv --python 3.12 .venv >/dev/null 2>&1 || python3 -m venv .venv
    ./.venv/bin/pip -q install -r requirements.txt 2>/dev/null || uv pip install --python ./.venv/bin/python -r requirements.txt ) || info "HexStrike deps: review manually"
fi

# 8 — HexStrike offensive-tool suite (best-effort; HexStrike degrades gracefully for missing) ----
# Arch official-repo subset of the 150+ HexStrike wraps. AUR-only tools are left to the operator.
CORE_TOOLS=(nmap nikto whatweb gobuster ffuf sqlmap nuclei subfinder httpx amass masscan wpscan)
if have pacman; then
  info "installing core offensive tools (best-effort, needs sudo): ${CORE_TOOLS[*]}"
  sudo pacman -S --needed --noconfirm "${CORE_TOOLS[@]}" 2>/dev/null || info "some tools are AUR-only / need manual install — HexStrike will report which of its 150+ are unreachable"
else
  info "no pacman — install HexStrike's offensive binaries via your package manager as needed"
fi

info "done. Verify:  tools/security/scan.sh --layer ci   (SEMGREP_JOBS=1 if semgrep hits io_uring on this box)"
info "AI-pentest:  start the HexStrike server →  $HEXSTRIKE_DIR/.venv/bin/python3 $HEXSTRIKE_DIR/hexstrike_server.py  (:8888)"
info "             then a pentest session →  claude --mcp-config tools/security/mcp.json  (ptai + hexstrike). ptai needs no server."
