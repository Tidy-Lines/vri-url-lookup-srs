// server.js
import express from "express";

const app = express();
app.use(express.json());

// Allow your Vite dev origin during dev (adjust for prod as needed)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Single domain example: GET /api/sitemap?domain=vail.com
app.get("/api/sitemap", async (req, res) => {
  const domain = req.query.domain;
  if (!domain) return res.status(400).json({ error: "Missing ?domain=" });

  const url = `https://${domain}/contentsitemap.xml`;
  try {
    // Node 18+ has global fetch; on Node <18, add node-fetch
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const r = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "MyViteApp/1.0" },
    });
    clearTimeout(timeout);

    if (!r.ok) {
      return res.status(r.status).send(`Upstream error: ${r.statusText}`);
    }

    const xml = await r.text();
    res.setHeader("Content-Type", "application/xml");
    return res.status(200).send(xml);
  } catch (err) {
    console.error("Fetch error:", err);
    return res.status(500).json({ error: "Proxy fetch failed" });
  }
});

// Multiple domains in parallel: POST /api/sitemaps  { "domains": ["vail.com", "example.com"] }
app.post("/api/sitemaps", async (req, res) => {
  const { domains } = req.body || {};
  if (!Array.isArray(domains) || domains.length === 0) {
    return res.status(400).json({ error: "Provide { domains: [...] }" });
  }

  const results = await Promise.allSettled(
    domains.map(async (domain) => {
      const url = `https://${domain}/contentsitemap.xml`;
      const r = await fetch(url, { headers: { "User-Agent": "MyViteApp/1.0" } });
      if (!r.ok) throw new Error(`${domain}: ${r.status} ${r.statusText}`);
      const xml = await r.text();
      return { domain, xml };
    })
  );

  // return successes, plus any failures with reasons
  const ok = results
    .filter(r => r.status === "fulfilled")
    .map(r => r.value);
  const failed = results
    .filter(r => r.status === "rejected")
    .map(r => String(r.reason));

  res.json({ sitemaps: ok, failed });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
