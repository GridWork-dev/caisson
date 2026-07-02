#!/usr/bin/env bash
# Re-apply the two Strix local patches. They live in the installed package and REVERT
# on `uv tool upgrade strix-agent`, so re-run this after install / upgrade.
#
#   1. web_search  → Exa /answer  (upstream hardcodes Perplexity; we retired Perplexity)
#        file: strix/tools/web_search/tool.py
#   2. STRIX_READONLY=1 strips the apply_patch write tool (read-only pentest)
#        file: agents/sandbox/capabilities/filesystem.py
#
# Idempotent: each patch is marker-guarded, so running twice is a no-op.
set -euo pipefail

SP="$(echo "$HOME"/.local/share/uv/tools/strix-agent/lib/python*/site-packages)"
[ -d "$SP/strix" ] || { echo "strix-agent not found at $SP — run: uv tool install strix-agent" >&2; exit 1; }

python3 - "$SP" <<'PY'
import sys, pathlib
sp = pathlib.Path(sys.argv[1])

# ---- Patch 1: web_search -> Exa /answer ----
ws = sp / "strix/tools/web_search/tool.py"
s = ws.read_text()
if "api.exa.ai/answer" in s:
    print("patch1 web_search->exa: already applied")
else:
    if "\nimport os\n" not in s:
        s = s.replace("import logging\n", "import logging\nimport os\n", 1)
    old_key = '''    api_key = load_settings().integrations.perplexity_api_key
    if not api_key:
        logger.warning("web_search invoked without PERPLEXITY_API_KEY configured")
        return {
            "success": False,
            "error": (
                "Web search is not configured for this scan "
                "(operator needs to set PERPLEXITY_API_KEY). Proceed without it"
            ),
        }'''
    new_key = '''    # strix-agent local patch: Exa /answer instead of Perplexity (reverts on `uv tool upgrade`).
    api_key = os.environ.get("EXA_API_KEY")
    if not api_key:
        logger.warning("web_search invoked without EXA_API_KEY configured")
        return {
            "success": False,
            "error": (
                "Web search is not configured for this scan "
                "(operator needs to set EXA_API_KEY). Proceed without it"
            ),
        }'''
    old_call = '''    url = "https://api.perplexity.ai/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": "sonar-reasoning-pro",
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": query},
        ],
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=300)
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]'''
    new_call = '''    url = "https://api.exa.ai/answer"
    headers = {"x-api-key": api_key, "Content-Type": "application/json"}
    payload = {"query": f"{query}\\n\\n{_SYSTEM_PROMPT}", "text": True}

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=300)
        response.raise_for_status()
        data = response.json()
        content = data.get("answer") or ""
        cites = [c for c in (data.get("citations") or []) if isinstance(c, dict)]
        if cites:
            srcs = "\\n".join(f"- {c.get('title', '')}: {c.get('url', '')}" for c in cites)
            content = f"{content}\\n\\nSources:\\n{srcs}"'''
    for old, new, tag in ((old_key, new_key, "key"), (old_call, new_call, "call")):
        if old not in s:
            print(f"patch1 web_search: FAILED — anchor '{tag}' not found (strix version drift?)", file=sys.stderr); sys.exit(1)
        s = s.replace(old, new, 1)
    ws.write_text(s)
    print("patch1 web_search->exa: applied")

# ---- Patch 2: STRIX_READONLY strips apply_patch ----
fs = sp / "agents/sandbox/capabilities/filesystem.py"
s = fs.read_text()
if "STRIX_READONLY" in s:
    print("patch2 read-only apply_patch strip: already applied")
else:
    old = "        return [toolset.view_image, toolset.apply_patch]"
    new = ('''        # strix-agent local patch: STRIX_READONLY=1 strips the only write tool
        # (apply_patch) for read-only pentest runs. Reverts on `uv tool upgrade`.
        import os

        if os.environ.get("STRIX_READONLY") == "1":
            return [toolset.view_image]
        return [toolset.view_image, toolset.apply_patch]''')
    if old not in s:
        print("patch2 read-only: FAILED — anchor not found (agents SDK drift?)", file=sys.stderr); sys.exit(1)
    fs.write_text(s.replace(old, new, 1))
    print("patch2 read-only apply_patch strip: applied")

# compile check
import py_compile
for f in (ws, fs):
    py_compile.compile(str(f), doraise=True)
print("both files compile OK")
PY
