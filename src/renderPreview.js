function toStr(x) {
  return String(x ?? "").trim();
}

function escapeHtml(s) {
  return toStr(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderPreviewPage({
  hostBase,
  url,
  title,
  featuredImage, // OGImage
  snippet,
  htmlClean,
}) {
  const hb = toStr(hostBase).replace(/\/+$/, ""); // remove trailing slash
  const u = toStr(url);

  const safeTitle = escapeHtml(title || "Preview");
  const safeOrigin = escapeHtml(u || "");
  const safeOgImage = escapeHtml(featuredImage || "");
  const safeSnippet = escapeHtml(snippet || "");

  // ALWAYS your host (absolute), no mode for JSON
  const hrefJson = `${hb}/api/fetch-content?url=${encodeURIComponent(u)}`;
  const hrefRaw = `${hb}/api/fetch-content?mode=raw&url=${encodeURIComponent(
    u
  )}`;
  const hrefHtml = `${hb}/api/fetch-content?mode=html&url=${encodeURIComponent(
    u
  )}`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    :root{
      --bg:#ffffff; --text:#111827; --muted:#6b7280; --border:#e5e7eb;
      --card:#ffffff; --chip:#f3f4f6; --shadow:0 10px 30px rgba(17,24,39,.08);
      --radius:16px; --blue:#2563eb; --green:#10b981;
    }
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;}
    .wrap{max-width:980px;margin:0 auto;padding:22px}
    .top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}
    .brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.2px}
    .dot{width:10px;height:10px;border-radius:999px;background:var(--green);
      box-shadow:0 0 0 6px rgba(16,185,129,.12);}
    .actions{display:flex;gap:10px;flex-wrap:wrap}
    .btn{
      display:inline-flex;align-items:center;gap:8px;
      padding:9px 12px;border-radius:12px;
      border:1px solid var(--border);
      background:var(--card);
      color:var(--text);
      text-decoration:none;
      font-size:13px;
      box-shadow:0 2px 10px rgba(17,24,39,.04);
      cursor:pointer; user-select:none;
    }
    .btn:hover{border-color:#d1d5db}
    .btn.primary{border-color:rgba(37,99,235,.35);background:rgba(37,99,235,.06);color:#0f2a6b}
    .btn.ghost{background:#fff}
    .card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);
      box-shadow:var(--shadow);padding:18px}
    .meta{display:flex;gap:10px;flex-wrap:wrap;color:var(--muted);font-size:13px;margin-bottom:10px}
    .chip{
      display:flex;align-items:flex-start;gap:10px;
      padding:10px 12px;border-radius:14px;background:var(--chip);
      border:1px solid var(--border); width:100%;
    }
    .kv{flex:1;min-width:0}
    .k{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;margin-bottom:6px}
    .value{
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size:12.5px;color:#111827;
      white-space:pre-wrap; word-break:break-word; line-height:1.55;
    }
    .copy{flex:0 0 auto}
    h1{margin:10px 0 8px;font-size:28px;line-height:1.15;letter-spacing:-.3px}
    .snippet{margin:0 0 14px;color:var(--muted);line-height:1.55;font-size:14px}
    .section{margin-top:14px;border-top:1px solid var(--border);padding-top:14px}
    .label{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px}
    .og{display:grid;grid-template-columns:220px 1fr;gap:12px;align-items:start}
    .ogimg{
      width:100%;border-radius:14px;border:1px solid var(--border);
      background:#fafafa;overflow:hidden;aspect-ratio:16/10;
      display:flex;align-items:center;justify-content:center;
    }
    .ogimg img{width:100%;height:100%;object-fit:cover;display:block}
    .content{margin-top:14px;color:#111827}
    .content :where(p,li){line-height:1.8;font-size:16px}
    .content :where(h1,h2,h3){line-height:1.25;margin:18px 0 10px}
    .content img{max-width:100%;height:auto;border-radius:12px;border:1px solid var(--border)}
    .content a{color:var(--blue);text-decoration:none}
    .content a:hover{text-decoration:underline}
    code,pre{background:#0b1020;color:#e5e7eb;border-radius:14px;padding:10px;overflow:auto}
    .hint{color:var(--muted);font-size:12px;margin-top:8px}
    @media (max-width:820px){.og{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div class="brand">
        <span class="dot"></span>
        <span>Preview</span>
      </div>

      <div class="actions">
        <a class="btn ghost" href="${hrefJson}" target="_blank" rel="noopener">JSON</a>
        <a class="btn ghost" href="${hrefRaw}" target="_blank" rel="noopener">RAW</a>
        <a class="btn primary" href="${hrefHtml}" target="_blank" rel="noopener">HTML</a>
      </div>
    </div>

    <div class="card">
      <div class="meta">
        <div class="chip">
          <div class="kv">
            <div class="k">Origin</div>
            <div class="value" id="originText">${
              safeOrigin || "(unknown)"
            }</div>
          </div>
          <div class="copy">
            <button class="btn" type="button" data-copy="#originText">Copy</button>
          </div>
        </div>
      </div>

      <h1>${safeTitle}</h1>
      ${snippet ? `<p class="snippet">${safeSnippet}</p>` : ""}

      <div class="section">
        <div class="label">OGImage</div>
        <div class="og">
          <div class="ogimg">
            ${
              featuredImage
                ? `<img src="${safeOgImage}" alt="OGImage" />`
                : `<span class="k">No OG image</span>`
            }
          </div>

          <div class="chip" style="margin:0">
            <div class="kv">
              <div class="k">URL</div>
              <div class="value" id="ogImageText">${
                safeOgImage || "(empty)"
              }</div>
              <div class="hint">RAW = HTML gốc (không thêm UI). HTML = preview (có UI).</div>
            </div>
            <div class="copy">
              <button class="btn" type="button" data-copy="#ogImageText">Copy</button>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="label">Content</div>
        <div class="content">
          ${htmlClean || ""}
        </div>
      </div>
    </div>
  </div>

  <script>
    (function () {
      function getTextFromSelector(sel) {
        var el = document.querySelector(sel);
        return el ? (el.innerText || el.textContent || "").trim() : "";
      }

      async function copyText(text) {
        text = (text || "").trim();
        if (!text) return false;

        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
          }
        } catch (e) {}

        try {
          var ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.style.position = "fixed";
          ta.style.top = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          var ok = document.execCommand("copy");
          document.body.removeChild(ta);
          return !!ok;
        } catch (e) {
          return false;
        }
      }

      function flash(btn, ok) {
        var old = btn.textContent;
        btn.textContent = ok ? "Copied" : "Failed";
        btn.style.borderColor = ok ? "rgba(16,185,129,.5)" : "rgba(239,68,68,.5)";
        btn.style.background = ok ? "rgba(16,185,129,.08)" : "rgba(239,68,68,.06)";
        setTimeout(function () {
          btn.textContent = old;
          btn.style.borderColor = "";
          btn.style.background = "";
        }, 900);
      }

      document.addEventListener("click", async function (e) {
        var btn = e.target && e.target.closest && e.target.closest("[data-copy]");
        if (!btn) return;

        var sel = btn.getAttribute("data-copy");
        var text = getTextFromSelector(sel);
        var ok = await copyText(text);
        flash(btn, ok);
      });
    })();
  </script>
</body>
</html>`;
}

module.exports = { renderPreviewPage };
