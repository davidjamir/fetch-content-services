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

function normImgUrl(u) {
  u = toStr(u).replace(/&amp;/g, "&");
  if (!u) return "";
  u = u.split("#")[0].split("?")[0];
  return u.replace(/\/+$/, "");
}

function ensureOgImageInRoot($, $root, ogImage, opts = {}) {
  const addThumb = !!opts.addThumb;
  ogImage = toStr(ogImage);

  if (!addThumb) return { added: false, reason: "disabled" };
  if (!ogImage) return { added: false, reason: "no_og_image" };
  if (!$root || !$root.length) return { added: false, reason: "no_root" };

  const firstSrc = toStr($root.find("img").first().attr("src"));
  const same100 =
    normImgUrl(firstSrc) && normImgUrl(firstSrc) === normImgUrl(ogImage);

  if (same100) return { added: false, reason: "already_first_img" };

  $root.prepend(
    `<div class="og-thumb" style="margin:0 0 12px;">
      <img src="${ogImage}" alt="" style="max-width:100%;height:auto;border-radius:12px;" />
    </div>`,
  );

  return { added: true, reason: "prepended" };
}

function buildSnippet(text, maxLen = 290) {
  const s = toStr(removeLinks(text)).replace(/\s+/g, " ");
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1).trimEnd() + "…";
}
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

function cleanArticleHtml(html, opts = {}) {
  const featuredImage = toStr(opts.featuredImage);
  const addThumb = !!opts.addThumb;
  const $ = cheerio.load(html);

  // drop noisy nodes
  $(
    "script,noscript,style,iframe,svg,canvas,form,nav,header,footer,aside",
  ).remove();

  // best effort: pick main content area
  const candidates = [
    "article",
    "main",
    "[role=main]",
    ".post",
    ".entry-content",
    ".article-content",
  ];
  let $root = null;

  for (const sel of candidates) {
    const el = $(sel).first();
    if (el && el.length) {
      $root = el;
      break;
    }
  }
  if (!$root) $root = $("body").first();
  if (!$root || !$root.length) $root = $.root();

  $root.find(REMOVE_CLASSES.map((c) => `.${c}`).join(",")).remove();
  // apply within root only to avoid nuking whole page unnecessarily
  $root.find(AD_SELECTORS.join(",")).remove();

  // remove HTML comments: <!-- ... -->
  $root
    .add($root.find("*"))
    .contents()
    .each((_, node) => {
      if (node?.type === "comment") $(node).remove();
    });

  const thumbResult = ensureOgImageInRoot($, $root, featuredImage, {
    addThumb,
  });

  const text = $root.text();
  const snippet = buildSnippet(text);
  const htmlClean = $root.html() || "";
  return { htmlClean, snippet, thumb: thumbResult };
}

module.exports = { cleanArticleHtml };
