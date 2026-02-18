const { fetchHtmlSmart } = require("../src/fetchHtml");
const { extractMeta } = require("../src/extract");
const { cleanArticleHtml } = require("../src/clean");
const { renderPreviewPage } = require("../src/renderPreview");
const { isAuthorized } = require("../helper/isAuthorized");

function toStr(x) {
  return String(x ?? "").trim();
}

function normalizeMode(m) {
  m = toStr(m).toLowerCase();
  if (!m) return "json";
  if (m === "raw" || m === "html" || m === "json") return m;
  return "json";
}

function getHostBase(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "https")
    .split(",")[0]
    .trim();

  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim();

  return host ? `${proto}://${host}` : "http://localhost";
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    const urlObj = new URL(
      req.url,
      `https://${req.headers.host || "localhost"}`,
    );
    const sp = urlObj.searchParams;
    const mode = normalizeMode(sp.get("mode") || "json");
    const targetUrl = sp.get("url") || ""; // URL bài gốc

    if (!targetUrl)
      return res.status(400).json({ ok: false, error: "Missing url" });

    if (mode === "json" && !isAuthorized(req)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const rawHtml = await fetchHtmlSmart(targetUrl, { timeoutMs: 15000 });
    const meta = extractMeta(rawHtml, targetUrl);
    const cleaned = cleanArticleHtml(rawHtml, {
      featuredImage: meta.featuredImage || "",
    });

    if (mode === "raw") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(cleaned.htmlClean);
    }

    if (mode === "html") {
      const page = renderPreviewPage({
        hostBase: getHostBase(req),
        url: targetUrl,
        title: meta.title || "Preview",
        featuredImage: meta.featuredImage || "",
        snippet: cleaned.snippet || "",
        htmlClean: cleaned.htmlClean || "",
      });

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(page);
    }

    return res.status(200).json({
      ok: true,
      image: toStr(meta.featuredImage),
      html: cleaned.htmlClean || "",
      snippet: toStr(cleaned.snippet),
    });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || "Unknown error" });
  }
};
