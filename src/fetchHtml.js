const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium-min");

function toStr(x) {
  return String(x ?? "").trim();
}

function isHttpUrl(u) {
  return /^https?:\/\//i.test(u);
}

// const viewport = {
//   deviceScaleFactor: 1,
//   hasTouch: false,
//   height: 1080,
//   isLandscape: true,
//   isMobile: false,
//   width: 1920,
// };

// async function getBrowser() {
//   return puppeteer.launch({
//     args: puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
//     defaultViewport: viewport,
//     executablePath: await chromium.executablePath("../chromium"),
//     headless: "shell",
//   });
// }

// async function fetchHtml(url, { timeoutMs = 20000 } = {}) {
//   url = toStr(url);
//   if (!isHttpUrl(url)) throw new Error("url must start with http(s)://");

//   try {
//     const browser = await getBrowser();

//     const page = await browser.newPage();

//     await page.goto(url, { waitUntil: "load", timeout: timeoutMs });

//     const html = await page.content();
//     await browser.close();
//     if (!html) throw new Error("empty html");
//     return html;
//   } catch (error) {
//     throw new Error(`Puppeteer error: ${error.message}`);
//   }
// }

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

// await page.setRequestInterception(true);
// page.on("request", (request) => {
//   const url = request.url();
//   if (
//     url.includes("advertising") ||
//     url.includes("ad") ||
//     url.includes(".jpg") ||
//     url.includes(".png") ||
//     url.includes(".gif") || // Chặn cả hình ảnh động
//     url.includes("video") || // Chặn video
//     url.includes(".css") || // Chặn CSS nếu không cần thiết
//     url.includes(".js") // Chặn Javascript nếu không cần thiết
//   ) {
//     request.abort(); // Chặn tài nguyên không cần thiết
//   } else {
//     request.continue(); // Tiếp tục tải các tài nguyên cần thiết
//   }
// });

// "https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.arm64.tar",
