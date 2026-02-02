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

module.exports = { fetchHtml };