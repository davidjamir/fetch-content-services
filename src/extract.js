const cheerio = require("cheerio");

function toStr(x) {
  return String(x ?? "").trim();
}

function removeLinks(text) {
  if (!text) return "";

  return (
    String(text)
      // remove http / https links
      .replace(/https?:\/\/[^\s)>\]"'}]+/gi, "")
      // cleanup extra spaces
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

function firstContent($, selectors) {
  for (const sel of selectors) {
    const v = toStr($(sel).first().attr("content"));
    if (v) return v;
  }
  return "";
}

function firstAttr($, selectors, attr) {
  for (const sel of selectors) {
    const v = toStr($(sel).first().attr(attr));
    if (v) return v;
  }
  return "";
}

function extractMeta(html, inputUrl = "") {
  const $ = cheerio.load(html);

  const title =
    firstContent($, [
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
    ]) || toStr($("title").first().text());

  const description = firstContent($, [
    'meta[property="og:description"]',
    'meta[name="description"]',
    'meta[name="twitter:description"]',
  ]);

  const featuredImage = firstContent($, [
    'meta[property="og:image:secure_url"]',
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
  ]);

  const canonical =
    firstAttr($, ['link[rel="canonical"]'], "href") ||
    firstContent($, ['meta[property="og:url"]']) ||
    inputUrl;

  return {
    title: removeLinks(title),
    description: removeLinks(description),
    featuredImage,
    canonical,
  };
}

module.exports = { extractMeta };
