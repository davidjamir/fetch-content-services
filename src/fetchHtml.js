const LOCAL_URL =
  "https://turtle-neat-closely.ngrok-free.app/api/fetch-html?options=0";

function toStr(x) {
  return String(x ?? "").trim();
}

function isHttpUrl(u) {
  return /^https?:\/\//i.test(u);
}

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
];

function randomUA() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

async function fetchCrawl(url, timeoutMs = 1200) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // UA đơn giản nhưng đủ dùng cho nhiều site
        "user-agent": randomUA(),
        "ngrok-skip-browser-warning": "true",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!r.ok) throw new Error(`fetch failed: ${r.status} ${r.statusText}`);

    return r;
  } catch (err) {
    throw new Error(err.response?.statusCode || err.message);
  } finally {
    clearTimeout(t);
  }
}

// Dự phòng trường hợp bị lỗi
async function fetchHtml(url, { timeoutMs = 12000 } = {}) {
  url = toStr(url);
  if (!isHttpUrl(url)) throw new Error("url must start with http(s)://");

  try {
    const r = await fetchCrawl(url, timeoutMs);

    if (!r.ok) throw new Error(`fetch failed: ${r.status} ${r.statusText}`);
    const html = await r.text();
    if (!html) throw new Error("empty html");
    return html;
  } catch (err) {
    throw new Error(err.response?.statusCode || err.message);
  }
}

async function fetchHtmlLocal(url, { timeoutMs = 12000 } = {}) {
  url = toStr(url);
  if (!isHttpUrl(url)) throw new Error("url must start with http(s)://");

  try {
    const r = await fetchCrawl(`${LOCAL_URL}&url=${url}`, timeoutMs);
    if (!r.ok) throw new Error("local server returned not ok");

    const json = await r.json();
    if (!json.ok) throw new Error("local server returned not ok");
    if (!json.result) throw new Error("empty html");

    return json.result;
  } catch (err) {
    throw new Error(err.response?.statusCode || err.message);
  }
}

async function fetchHtmlOnline() {}

async function fetchHtmlSmart(url, options) {
  const strategies = [
    async () => {
      console.log("Try Crawl Manual...");
      return await fetchHtml(url);
    },
    async () => {
      console.log("Try Crawl Local...");
      return await fetchHtmlLocal(url);
    },
    async () => {
      console.log("Try Crawl Online...");
      return await fetchHtmlOnline(url);
    },
  ];

  // ===== Nếu có option -> chạy đúng 1 strategy =====
  if (options !== undefined) {
    if (!strategies[options]) {
      throw new Error("INVALID_OPTION");
    }

    return await strategies[options]();
  }

  // ===== Nếu không có option -> auto fallback =====
  let lastError;

  for (let i = 0; i < strategies.length; i++) {
    try {
      return await strategies[i]();
    } catch (err) {
      console.log(`Strategy ${i} failed:`, err?.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error("ALL_STRATEGIES_FAILED");
}

module.exports = { fetchHtml, fetchHtmlSmart };
