const { fetchHtmlSmart, fetchHtml } = require("../src/fetchHtml");

module.exports = async (req, res) => {
  const { url } = req.query;
  const { options } = req.query;

  if (!url) {
    return res.status(400).json({
      ok: false,
      error: "Missing url param",
    });
  }

  try {
    const result = !options ? await fetchHtml(url) : await fetchHtmlSmart(url);
    return res.status(200).json({ ok: true, options, body: result });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
};
