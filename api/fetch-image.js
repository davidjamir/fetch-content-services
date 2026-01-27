// api/fetch-image.js
const { fetchHtml } = require("../src/fetchHtml");
const { extractMeta } = require("../src/extract");
const { cleanArticleHtml } = require("../src/clean");
const { isAuthorized } = require("../helper/isAuthorized");

function toStr(x) {
  return String(x ?? "").trim();
}

function isHttpUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === "http:" || x.protocol === "https:";
  } catch {
    return false;
  }
}

function toInt(x, d) {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const urlObj = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  const sp = urlObj.searchParams;

  const targetUrl = toStr(sp.get("url"));
  if (!targetUrl)
    return res.status(400).json({ ok: false, error: "Missing url" });
  if (!isHttpUrl(targetUrl))
    return res
      .status(400)
      .json({ ok: false, error: "Invalid url (http/https only)" });

  const format = (sp.get("format") || "json").toLowerCase(); // json | text
  const redirect = ["1", "true", "yes"].includes(
    (sp.get("redirect") || "").toLowerCase()
  );
  const timeoutMs = Math.min(
    Math.max(toInt(sp.get("timeout"), 15000), 1000),
    60000
  );

  try {
    // chỉ fetch html để bóc meta (nhẹ hơn nhiều so với clean nội dung)
    const rawHtml = await fetchHtml(targetUrl, { timeoutMs });
    const meta = extractMeta(rawHtml, targetUrl);
    const cleaned = cleanArticleHtml(rawHtml);

    const featuredImage = toStr(meta?.featuredImage);

    if (!featuredImage) {
      // không tìm thấy og image
      if (format === "text") {
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        return res.status(200).send("");
      }
      return res.status(200).json({ ok: true, image: "" });
    }

    if (redirect) {
      // mở thẳng ảnh
      res.setHeader("Location", featuredImage);
      return res.status(302).end();
    }

    if (format === "text") {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.status(200).send(featuredImage);
    }

    const isText = format === "text";
    const wantsJson = !redirect && !isText;

    if (wantsJson && !isAuthorized(req)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    return res.status(200).json({
      ok: true,
      image: featuredImage,
      snippet: toStr(cleaned.snippet),
    });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: toStr(e?.message) || "fetch-image failed" });
  }
};
