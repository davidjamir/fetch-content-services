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
  ".ads-inline",

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
  "clearfix",

  // thêm class của mày vào đây
];

const DROP_TYPES = new Set(["script", "noscript", "style"]);
const DROP_NAMES = new Set([
  "h1",
  "svg",
  "canvas",
  "form",
  "nav",
  "header",
  "footer",
  "aside",
  "ins",
]);

const REMOVE_CLASS_SET = new Set(
  REMOVE_CLASSES.map((c) => c.toLowerCase()).concat(
    AD_SELECTORS.filter((s) => s.startsWith(".")).map((s) =>
      s.slice(1).toLowerCase(),
    ),
  ),
);

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

function handleFeaturedImage($root, ogImage) {
  let reason = "no_og_image";
  if (!ogImage) return { added: false, reason };

  const firstImg = $root.find("img").first();
  const firstSrc = toStr(firstImg.attr("src") || "");

  console.log(ogImage);
  console.log(firstSrc);

  if (firstSrc && sameImageBySemanticIdentity(firstSrc, ogImage)) {
    reason = "same_image";
    firstImg.remove();
  }

  // prepend og image
  $root.prepend(
    `<div class="og-thumb" style="margin:0 0 12px;display:flex;justify-content:center">
      <img src="${ogImage}" style="max-width:100%;height:auto;border-radius:12px" />
    </div>`,
  );

  return { added: true, reason };
}

/*
 *
 * Clean HTML
 *
 */

function pickMainRoot($, ctx) {
  if (ctx.articles.length > 0) {
    return $(ctx.articles.reduce((a, b) => (b.score > a.score ? b : a)).node);
  }

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

function removeNode(node) {
  const p = node.parent;
  if (!p || !p.children) return;
  p.children = p.children.filter((n) => n !== node);
}

function dfs(node, ctx) {
  if (!node) return { hasArticle: false };

  if (node.type === "root") {
    let hasArticle = false;
    for (const c of node.children || []) {
      if (dfs(c, ctx).hasArticle) hasArticle = true;
    }
    return { hasArticle };
  }

  // ===============================
  // 👇 CHỖ MÀY VIẾT LOGIC XỬ LÝ
  // ví dụ:
  // if (node.type === "comment") { ... }
  // if (node.type === "tag" && node.name === "iframe") { ... }
  // if (node.name === "article") { ... }
  // if (node.name === "img") { ... }
  // ===============================

  // DROP BY TYPE (🔥 CỰC SỚM)
  if (DROP_TYPES.has(node.type)) {
    removeNode(node);
    return { hasArticle: false };
  }

  // ===== COMMENT =====
  if (node.type === "comment") {
    removeNode(node);
    return { hasArticle: false };
  }

  // TEXT
  if (node.type === "text") {
    return { hasArticle: false, textLen: (node.data || "").trim().length };
  }

  // TỪ ĐÂY TRỞ XUỐNG: CHỈ CÒN TAG
  if (node.type !== "tag") {
    return { hasArticle: false };
  }

  // DROP BY NAME
  if (DROP_NAMES.has(node.name)) {
    removeNode(node);
    return { hasArticle: false };
  }

  // ===== IFRAME =====
  if (node.name === "iframe") {
    const src = (node.attribs?.src || "").toLowerCase();
    const isVideo = src && VIDEO_IFRAME_HOSTS.some((h) => src.includes(h));

    if (!isVideo) {
      removeNode(node);
    }

    return { hasArticle: false };
  }

  // ===== REMOVE BY CLASS =====
  const classAttr = node.attribs?.class;
  if (classAttr) {
    const classes = classAttr.toLowerCase().split(/\s+/);
    for (const c of classes) {
      if (REMOVE_CLASS_SET.has(c)) {
        removeNode(node);
        return { hasArticle: false }; // ⛔ cắt subtree
      }
    }
  }

  // ===== FIRST IMG =====
  let imgCount = 0;
  let textLen = 0;
  let pCount = node.name === "p" ? 1 : 0;
  let hasArticleBelow = false;

  // ===== WALK CHILDREN =====
  for (const child of node.children || []) {
    const res = dfs(child, ctx);

    if (res?.hasArticle) hasArticleBelow = true;
    textLen += res?.textLen || 0;
    pCount += res?.pCount || 0;
    imgCount += res?.imgCount || 0;
  }

  // ===== ARTICLE NODE =====
  if (node.name === "article") {
    if (!hasArticleBelow) {
      const score = textLen + pCount * 100 + imgCount * 30;

      ctx.articles.push({
        node,
        score,
        textLen,
        pCount,
        imgCount,
      });
    }
  }

  const isArticle = node.name === "article";

  return {
    hasArticle: hasArticleBelow || isArticle,
    textLen,
    pCount,
    imgCount,
  };
}

function cleanArticleHtml(html, opts = {}) {
  const featuredImage = toStr(opts.featuredImage);
  const $ = cheerio.load(html);

  const ctx = {
    articles: [],
  };

  dfs($.root()[0], ctx);

  // pick root
  const $root = pickMainRoot($, ctx);

  const thumbResult = handleFeaturedImage($root, featuredImage);
  console.log("Reason: ", thumbResult.reason);

  const snippet = buildSnippet($root.text());
  const htmlClean = $root.html() || "";

  return { htmlClean, snippet, thumb: thumbResult };
}

module.exports = { cleanArticleHtml };
