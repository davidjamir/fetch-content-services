function isAuthorized(req) {
  const REQUIRE_AUTH =
    String(process.env.REQUIRE_AUTH || "").toLowerCase() === "true";
  const SERVER_SECRET = process.env.SERVER_SECRET || "";

  if (!REQUIRE_AUTH) return true;
  if (!SERVER_SECRET) return false;

  const auth = req.headers["authorization"] || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  return token && token === SERVER_SECRET;
}

module.exports = { isAuthorized };
