import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/m3u/proxy", async (req, res) => {
  const { url } = req.query as { url?: string };

  if (!url) {
    res.status(400).json({ error: "url query parameter is required" });
    return;
  }

  let targetUrl: string;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      res.status(400).json({ error: "Only http and https URLs are supported" });
      return;
    }
    targetUrl = parsed.toString();
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; IPTV-Player/1.0)",
        Accept: "*/*",
      },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err: any) {
    res.status(502).json({ error: `Cannot reach URL: ${err?.message ?? "connection failed"}` });
    return;
  }

  if (!response.ok) {
    res.status(response.status).json({ error: `Upstream returned ${response.status}` });
    return;
  }

  const text = await response.text();
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(text);
});

export default router;
