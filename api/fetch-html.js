const { fetchHtmlSmart } = require("../src/fetchHtml");

function toStr(x) {
  return String(x ?? "").trim();
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const urlObj = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  const sp = urlObj.searchParams;
  const url = toStr(sp.get("url"));
  const options = sp.get("options") || -1;

  if (!url) {
    return res.status(400).json({
      ok: false,
      error: "Missing url param",
    });
  }

  try {
    const result =
      options >= 0
        ? await fetchHtmlSmart(url, options)
        : await fetchHtmlSmart(url);
    return res.status(200).json({ ok: true, options, result });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
};
