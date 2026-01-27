const { XMLParser, XMLBuilder } = require("fast-xml-parser");

function toStr(x) {
  return String(x ?? "").trim();
}

function isHttpUrl(u) {
  return /^https?:\/\//i.test(u);
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const urlObj = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  const sp = urlObj.searchParams;

  const url = toStr(sp.get("url"));
  if (!isHttpUrl(url)) throw new Error("url must start with http(s)://");

  const feedUrl = `https://morss.it/:items=%7C%7C*[class=content]/${url}`;

  if (!feedUrl) {
    return res.status(400).send("Missing URL parameter");
  }

  try {
    // Lấy XML từ URL bằng fetch
    const response = await fetch(feedUrl);

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: `Failed to fetch the feed: ${response.statusText}`,
      });
    }

    const xmlData = await response.text(); // Lấy nội dung XML dưới dạng text

    // Parse XML feed thành JSON
    const parser = new XMLParser();
    const feedData = parser.parse(xmlData);

    // Xử lý từng item trong feed
    const processedItems = feedData.rss.channel.item.map((item) => {
      const parts = item.title.replace(/\n+/g, "\n").trim().split("\n");

      const title = parts[0] || ""; // Kiểm tra để tránh null/undefined
      const date = parts[1] ? parts[1].replace("Posted ", "").trim() : "";
      const description = parts.slice(2).join(" ").trim() || "";
      const contentEncoded = item["ns0:encoded"] || "";

      // Trả về item đã xử lý
      return {
        title: title,
        link: item.link,
        pubDate: date,
        description: description,
        "content:encoded": contentEncoded,
      };
    });

    // Xây dựng lại XML đã xử lý
    const xmlBuilder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
      processDeclaration: true,
      cdataPropName: "__cdata",
    });

    const processedFeed = {
      "?xml": {
        "@_version": "1.0",
        "@_encoding": "UTF-8",
      },
      rss: {
        "@_version": "2.0",
        "@_xmlns:content": "http://purl.org",
        "@_xmlns:dc": "http://purl.org",
        channel: {
          title: feedData.rss?.channel?.title || "My Feed",
          link: feedData.rss?.channel?.link || "",
          description: feedData.rss?.channel?.description || "",
          language: "vi",
          item: processedItems.map((item) => ({
            title: item.title,
            link: item.link,
            pubDate: item.pubDate,
            description: item.description,
            // Đây là cách tạo content:encoded chuẩn
            "content:encoded": {
              __cdata: item["content:encoded"],
            },
          })),
        },
      },
    };

    // Build XML từ dữ liệu đã xử lý
    const newXML = xmlBuilder.build(processedFeed);

    res.setHeader("Content-Type", "application/xml");
    res.send(newXML);
  } catch (error) {
    console.error("Error processing feed:", error);
    res.status(500).send("Error processing feed");
  }
};
