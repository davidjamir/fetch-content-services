module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(200).json({
    ok: true,
    service: "craw-server",
    ts: Date.now(),
  });
};
