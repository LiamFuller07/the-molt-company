#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MD_PATH="${ROOT_DIR}/MASTER_PLAN.md"
OUT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/master-plan.html"

if [[ ! -f "$MD_PATH" ]]; then
  echo "Missing: $MD_PATH" >&2
  exit 1
fi

if rg -q "</textarea>" "$MD_PATH" 2>/dev/null; then
  echo "MASTER_PLAN.md contains </textarea> which would break HTML embedding." >&2
  echo "Fix by removing/altering that sequence, or switch to offline.html + file picker." >&2
  exit 1
fi

cat >"$OUT_PATH" <<'HTML'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>The Molt Company — Master Plan</title>
    <link rel="stylesheet" href="vendor/github-markdown-light.css" />
    <style>
      :root {
        --bg: #0b1020;
        --panel: rgba(255, 255, 255, 0.06);
        --border: rgba(255, 255, 255, 0.12);
        --text: rgba(255, 255, 255, 0.92);
        --muted: rgba(255, 255, 255, 0.7);
        --link: #7dd3fc;
        --toc-link: rgba(255, 255, 255, 0.82);
        --toc-link-muted: rgba(255, 255, 255, 0.72);
      }

      body {
        margin: 0;
        background: radial-gradient(1200px 600px at 20% -10%, #1b2a4a 0%, transparent 60%),
          radial-gradient(900px 500px at 110% 0%, #3b1d5a 0%, transparent 60%),
          var(--bg);
        color: var(--text);
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto,
          Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
      }

      a {
        color: var(--link);
      }

      header {
        position: sticky;
        top: 0;
        z-index: 10;
        backdrop-filter: blur(10px);
        background: rgba(11, 16, 32, 0.82);
        border-bottom: 1px solid var(--border);
      }

      .bar {
        display: flex;
        gap: 12px;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        max-width: 1400px;
        margin: 0 auto;
      }

      .title {
        font-weight: 650;
        letter-spacing: 0.2px;
      }

      .subtitle {
        font-size: 12px;
        color: var(--muted);
        margin-top: 2px;
      }

      .layout {
        display: grid;
        grid-template-columns: 320px minmax(0, 1fr);
        gap: 16px;
        max-width: 1400px;
        margin: 0 auto;
        padding: 16px 16px 64px;
      }

      aside {
        position: sticky;
        top: 72px;
        align-self: start;
        border: 1px solid var(--border);
        background: var(--panel);
        border-radius: 14px;
        padding: 12px;
        max-height: calc(100vh - 92px);
        overflow: auto;
      }

      .toc-title {
        font-size: 12px;
        font-weight: 650;
        color: rgba(255, 255, 255, 0.9);
        text-transform: uppercase;
        letter-spacing: 0.8px;
        margin-bottom: 10px;
      }

      .toc-search {
        width: 100%;
        box-sizing: border-box;
        margin-bottom: 10px;
        border-radius: 10px;
        padding: 8px 10px;
        border: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.06);
        color: var(--text);
        outline: none;
      }

      .toc-search::placeholder {
        color: rgba(255, 255, 255, 0.55);
      }

      .toc ul {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .toc li {
        margin: 0;
      }

      .toc a {
        display: block;
        padding: 6px 8px;
        border-radius: 10px;
        color: var(--toc-link);
        text-decoration: none;
        line-height: 1.2;
      }

      .toc a:hover {
        background: rgba(255, 255, 255, 0.08);
      }

      .toc .h3 a {
        padding-left: 18px;
        color: var(--toc-link-muted);
        font-size: 13px;
      }

      main .card {
        border: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.94);
        border-radius: 14px;
        padding: 18px;
      }

      .markdown-body {
        box-sizing: border-box;
        min-width: 200px;
        max-width: 980px;
        margin: 0 auto;
        padding: 8px;
        color: #111;
      }

      @media (max-width: 1024px) {
        .layout {
          grid-template-columns: 1fr;
        }
        aside {
          position: relative;
          top: 0;
          max-height: none;
        }
      }
    </style>
  </head>
  <body>
    <header>
      <div class="bar">
        <div>
          <div class="title">The Molt Company — Master Plan</div>
          <div class="subtitle">
            Single-file viewer (no server, no CDN). Regenerate with
            <code>plan-viewer/build-master-plan-html.sh</code>.
          </div>
        </div>
      </div>
    </header>

    <div class="layout">
      <aside>
        <div class="toc-title">Contents</div>
        <input
          id="tocSearch"
          class="toc-search"
          placeholder="Filter sections…"
          autocomplete="off"
        />
        <nav id="toc" class="toc"></nav>
      </aside>

      <main>
        <div class="card">
          <article id="content" class="markdown-body">Loading…</article>
        </div>
      </main>
    </div>

    <textarea id="md" style="display: none">
HTML

cat "$MD_PATH" >>"$OUT_PATH"

cat >>"$OUT_PATH" <<'HTML'
    </textarea>

    <script src="vendor/marked.min.js"></script>
    <script>
      const contentEl = document.getElementById("content");
      const tocEl = document.getElementById("toc");
      const tocSearch = document.getElementById("tocSearch");
      const md = document.getElementById("md").value;

      marked.setOptions({ gfm: true, breaks: false });
      contentEl.innerHTML = marked.parse(md);

      function slugify(text) {
        return text
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\\s-]/g, "")
          .replace(/\\s+/g, "-")
          .replace(/-+/g, "-");
      }

      const used = new Map();
      function uniqueSlug(base) {
        const n = used.get(base) || 0;
        used.set(base, n + 1);
        return n === 0 ? base : `${base}-${n}`;
      }

      const headings = Array.from(contentEl.querySelectorAll("h2, h3"));
      const items = [];

      for (const h of headings) {
        const text = (h.textContent || "").trim();
        if (!text) continue;
        const base = slugify(text);
        if (!base) continue;
        const id = uniqueSlug(base);
        h.id = id;
        items.push({ level: h.tagName === "H2" ? 2 : 3, text, id });
      }

      function renderToc(filter) {
        const q = (filter || "").toLowerCase().trim();
        const filtered = q
          ? items.filter((it) => it.text.toLowerCase().includes(q))
          : items;
        tocEl.innerHTML =
          "<ul>" +
          filtered
            .map(
              (it) =>
                `<li class="h${it.level}"><a href="#${it.id}">${it.text}</a></li>`
            )
            .join("") +
          "</ul>";
      }

      tocSearch.addEventListener("input", () => renderToc(tocSearch.value));
      renderToc("");
    </script>
  </body>
</html>
HTML

echo "Wrote: $OUT_PATH"
