const cheerio = require("cheerio");

const AD_SELECTORS = [
  // google ads + generic ads
  ".ads",
  ".ad",
  ".adsbox",
  ".adsbygoogle",
  ".ad-container",
  ".ad-wrapper",
  ".ad-slot",
  ".adunit",
  ".ad-unit",
  ".advert",
  ".advertisement",
  ".advertising",
  ".banner-ad",
  ".ad-banner",

  // sponsor/promo
  ".sponsor",
  ".sponsored",
  ".sponsored-content",
  ".promo",
  ".promoted",
  ".promotion",

  // recommendation networks
  ".taboola",
  ".outbrain",
  ".revcontent",

  // popups / subscribe / newsletter
  ".newsletter",
  ".subscribe",
  ".subscription",
  ".modal",
  ".popup",

  // cookie banners
  ".cookie",
  ".cookie-banner",
  ".consent",
];

const VIDEO_IFRAME_HOSTS = [
  "youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "vimeo.com",
  "player.vimeo.com",
  "facebook.com",
  "fb.watch",
  "tiktok.com",
  "player.tiktok.com",
  "dailymotion.com",
];

const REMOVE_CLASSES = [
  "code-block",
  "cat-links",
  "entry-meta",
  "entry-labels",
  "post-share",
  "breadcrumbs-nav",
  "header",
  "recommended-thumbnail",
  "recommended-wrapper",
  "categories",

  // thêm class của mày vào đây
];

/*
 *
 * Clean Description
 *
 */

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

function cutPointerPrefixAnywhere(s) {
  if (!s) return "";

  // remove any fragment like "*]:pointer...>"
  s = s.replace(/\*?\]?:pointer[^>]*>/gi, " ");

  return s.replace(/\s+/g, " ").trim();
}

function buildSnippet(text, maxLen = 290) {
  let s = toStr(text);

  // 1. remove links
  s = removeLinks(s);

  // 2. normalize control chars + spaces
  s = s
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // 3. remove pointer garbage
  s = cutPointerPrefixAnywhere(s);

  if (s.length > maxLen) {
    s = s.slice(0, maxLen - 1).trimEnd() + "…";
  }
  return s;
}

/*
 *
 * Checking Featured Image
 *
 */

function normImgUrl(u) {
  u = toStr(u).replace(/&amp;/g, "&");
  if (!u) return "";
  u = u.split("#")[0].split("?")[0];
  return u.replace(/\/+$/, "");
}

function getHost(u) {
  try {
    return new URL(u).host;
  } catch {
    return "";
  }
}

function imageIdentityTokens(u) {
  return u
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split(/[\/\-_.]/)
    .filter(Boolean);
}

function sameImageBySemanticIdentity(a, b) {
  const ua = normImgUrl(a);
  const ub = normImgUrl(b);
  if (!ua || !ub) return false;
  if (getHost(ua) !== getHost(ub)) return false;

  const A = imageIdentityTokens(ua);
  const B = imageIdentityTokens(ub);
  if (A.length <= 1 || B.length <= 1) return false;

  const setA = new Set(A);
  const setB = new Set(B);

  let same = 0;
  for (const t of setA) {
    if (setB.has(t)) same++;
  }

  const minLen = Math.min(A.length, B.length);
  const maxLen = Math.max(A.length, B.length);

  const overlapRatio = same / minLen;
  const lengthRatio = minLen / maxLen;

  return (
    overlapRatio >= 0.8 && // gần như chứa trọn
    lengthRatio >= 0.5 // không được chênh lệch quá lớn
  );
}

function handleFeaturedImage($, $root, ogImage) {
  if (!ogImage) return { added: false, reason: "no_og_image" };

  const $firstImg = cloneRootWithoutIframes($root).find("img").first();
  const firstSrc = toStr($firstImg.attr("src"));

  console.log(ogImage);
  console.log(firstSrc);

  if (firstSrc && sameImageBySemanticIdentity(firstSrc, ogImage)) {
    // ảnh đầu đã là featured → không làm gì cả
    return { added: false, reason: "same_image" };
  }

  // prepend og image
  $root.prepend(
    `<div class="og-thumb" style="margin:0 0 12px">
      <img src="${ogImage}" style="max-width:100%;height:auto;border-radius:12px" />
    </div>`,
  );

  return { added: true, reason: "prepended" };
}

/*
 *
 * Clean HTML
 *
 */

function pickNestedMainArticle($) {
  let best = null;
  let bestScore = 0;

  $("article").each((_, el) => {
    const $el = $(el);

    const $probe = cloneRootWithoutIframes($el);

    // Nếu chứa article con → thường là wrapper
    if ($probe.find("article").length > 0) return;

    const text = $probe.text().trim();
    if (text.length < 300) return;

    const pCount = $probe.find("p").length;
    const imgCount = $probe.find("img").length;

    const score = text.length + pCount * 100 + imgCount * 30;

    if (score > bestScore) {
      bestScore = score;
      best = $el;
    }
  });

  return best;
}

function pickMainRoot($) {
  const $article = pickNestedMainArticle($);
  if ($article && $article.length) return $article;

  const candidates = [
    "main",
    "article",
    ".article-content",
    ".entry-content",
    "[role=main]",
    ".post",
  ];

  for (const sel of candidates) {
    const el = $(sel).first();
    if (el && el.length) return el;
  }

  return $("body").first().length ? $("body").first() : $.root();
}

function cleanRoot($, $root) {
  const REMOVE_SELECTOR = [
    ...REMOVE_CLASSES.map((c) => `.${c}`),
    ...AD_SELECTORS,
  ].join(",");
  $root.find(REMOVE_SELECTOR).remove();

  // remove comments
  removeCommentsSkippingIframes($, $root);
}

function removeAdIframesEarly($) {
  $("iframe").each((_, el) => {
    const src = toStr($(el).attr("src")).toLowerCase();
    if (!src) {
      $(el).remove();
      return;
    }

    const isVideo = VIDEO_IFRAME_HOSTS.some((h) => src.includes(h));
    if (!isVideo) {
      $(el).remove();
    }
  });
}

function removeCommentsSkippingIframes($, $node) {
  $node.contents().each((_, node) => {
    if (node.type === "comment") {
      $(node).remove();
      return;
    }

    if (node.type === "tag") {
      // ⛔ boundary: không đi vào iframe
      if (node.name === "iframe") return;

      removeCommentsSkippingIframes($, $(node));
    }
  });
}

function cloneRootWithoutIframes($root) {
  const $clone = $root.clone();

  // xoá toàn bộ iframe trong clone
  $clone.find("iframe").remove();

  return $clone;
}

function cleanArticleHtml(html, opts = {}) {
  const featuredImage = toStr(opts.featuredImage);
  const $ = cheerio.load(html);

  // drop noisy nodes
  $("script,noscript,style,svg,canvas,form,nav,header,footer,aside").remove();

  // 2️⃣ remove ad iframes EARLY
  removeAdIframesEarly($);

  // pick root
  const $root = pickMainRoot($);

  // clean inside root
  cleanRoot($, $root);

  const thumbResult = handleFeaturedImage($, $root, featuredImage);
  console.log("Reason: ", thumbResult.reason);

  const snippet = buildSnippet(cloneRootWithoutIframes($root).text());
  const htmlClean = $root.html() || "";

  return { htmlClean, snippet, thumb: thumbResult };
}

module.exports = { cleanArticleHtml };
