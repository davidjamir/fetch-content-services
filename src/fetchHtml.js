function toStr(x) {
  return String(x ?? "").trim();
}

function isHttpUrl(u) {
  return /^https?:\/\//i.test(u);
}

// Dự phòng trường hợp bị lỗi
async function fetchHtml(url, { timeoutMs = 12000 } = {}) {
  url = toStr(url);
  if (!isHttpUrl(url)) throw new Error("url must start with http(s)://");

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // UA đơn giản nhưng đủ dùng cho nhiều site
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!r.ok) throw new Error(`fetch failed: ${r.status} ${r.statusText}`);
    const html = await r.text();
    if (!html) throw new Error("empty html");
    return html;
  } finally {
    clearTimeout(t);
  }
}

/// Advanced Method Fetch HTML

const { CookieJar } = require("tough-cookie");

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
];

function randomUA() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchHtmlSmart(url, options = {}) {
  const got = (await import("got")).default;
  const { retries = 2, retryDelay = 2000, timeout = 20000 } = options;

  const cookieJar = new CookieJar();

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await got(url, {
        http2: true,
        cookieJar,
        timeout: { request: timeout },
        followRedirect: true,
        headers: {
          "User-Agent": randomUA(),
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        },
      });

      if (response.statusCode === 403) {
        throw new Error("HTTP_403");
      }

      return response.body;
    } catch (err) {
      const isLast = attempt === retries;

      console.log(
        `Attempt ${attempt + 1} failed:`,
        err.response?.statusCode || err.message,
      );

      if (isLast) {
        throw new Error(err.response?.statusCode || err.message);
      }

      await sleep(retryDelay);
    }
  }
}

module.exports = { fetchHtml, fetchHtmlSmart };
