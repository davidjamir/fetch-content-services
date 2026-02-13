const cheerio = require("cheerio");

/* ===============================
   CONFIG
================================ */
const REMOVE_KEYWORDS = [
  "qcimg",
  "adsconex",
  "mgid",
  "banner",
  "parallax",
  "adsense",
  "doubleclick",
  "adservice",
  "taboola",
  "outbrain",
  "revcontent",

  "post-extra-info",
  "share-buttons-bottom",
  "related-post",
  "system-listing",
  "system-nav"
];

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
  "twitter.com",
];

const REMOVE_CLASSES = [
  "code-block",
  "cat-links",
  "entry-meta",
  "entry-labels",
  "entry-tags",
  "entry-related",
  "post-share",
  "breadcrumbs-nav",
  "header",
  "recommended-thumbnail",
  "recommended-wrapper",
  "categories",
  "breadcrumbs",
  "bs-breadcrumb-section",
  "bs-related-post-info",
  "bs-header",
  "bs-single-related",
  "emoji"

  // thêm class của mày vào đây
];

const DROP_TYPES = new Set(["script", "noscript", "style"]);
const DROP_NAMES = new Set([
  "h1",
  "hr",
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

function hasRemoveKeyword(str = "") {
  const s = str.toLowerCase();
  return REMOVE_KEYWORDS.some((k) => s.includes(k));
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

function pickMainRoot($) {
  const candidates = [
    "#main",
    "main",
    "[role=main]",
    ".entry-content",
    ".post-content",
    ".article-content",
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

function unwrapNode(node) {
  const parent = node.parent;
  if (!parent || !parent.children) return;

  const idx = parent.children.indexOf(node);
  if (idx === -1) return;

  const children = node.children || [];

  for (const child of children) {
    child.parent = parent;
  }

  parent.children.splice(idx, 1, ...children);
}

function dfs(node) {
  if (!node) return;

  // ROOT
  if (node.type === "root") {
    for (const c of node.children || []) {
      dfs(c);
    }
    return;
  }

  // ===== DROP SỚM (KHÔNG CẦN DUYỆT CON) =====

  // DROP BY TYPE (🔥 CỰC SỚM)
  if (DROP_TYPES.has(node.type)) {
    removeNode(node);
    return;
  }

  // ===== COMMENT =====
  if (node.type === "comment") {
    removeNode(node);
    return;
  }

  // TEXT
  if (node.type === "text") {
    return;
  }

  // TỪ ĐÂY TRỞ XUỐNG: CHỈ CÒN TAG
  if (node.type !== "tag") {
    return;
  }

  // DROP BY NAME
  if (DROP_NAMES.has(node.name)) {
    removeNode(node);
    return;
  }

  // ===== IFRAME =====
  if (node.name === "iframe") {
    const src = (node.attribs?.src || "").toLowerCase();
    const isVideo = src && VIDEO_IFRAME_HOSTS.some((h) => src.includes(h));

    if (!isVideo) {
      console.log("Removed Iframe: ", src);
      removeNode(node);
    }
    return;
  }

  // ===== REMOVE BY CLASS =====
  const classAttr = node.attribs?.class;
  const idAttr = node.attribs?.id || "";

  if (classAttr) {
    const classes = classAttr.toLowerCase().split(/\s+/);
    for (const c of classes) {
      if (REMOVE_CLASS_SET.has(c)) {
        removeNode(node);
        return;
      }
    }
  }

  if (hasRemoveKeyword(classAttr) || hasRemoveKeyword(idAttr)) {
    removeNode(node);
    return;
  }

  // ===== CHỈ TỚI ĐÂY MỚI DUYỆT CON =====
  // vì các trường hợp trên đã xử lý xong rồi

  for (const child of [...(node.children || [])]) {
    dfs(child);
  }

  // ===== POST PROCESS (SAU KHI CON ĐÃ SẠCH) =====

  // unwrap article ở cuối để không phá traversal
  if (node.name === "article") {
    unwrapNode(node);
    return;
  }

  if (node.name === "div" && (!node.children || node.children.length === 0)) {
    removeNode(node);
    return;
  }
}

function cleanArticleHtml(html, opts = {}) {
  const featuredImage = toStr(opts.featuredImage);
  const $ = cheerio.load(html);

  dfs($.root()[0]);

  // pick root
  const $root = pickMainRoot($);

  const thumbResult = handleFeaturedImage($root, featuredImage);
  console.log("Reason: ", thumbResult.reason);

  const snippet = buildSnippet($root.text());
  const htmlClean = $root.html() || "";

  return { htmlClean, snippet, thumb: thumbResult };
}

module.exports = { cleanArticleHtml };
