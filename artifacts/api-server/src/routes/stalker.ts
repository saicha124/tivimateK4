import { Router, type IRouter } from "express";

const router: IRouter = Router();

function buildStalkerUrl(portal: string, params: Record<string, string>): string {
  const base = portal.replace(/\/+$/, "");
  const qs = new URLSearchParams({ ...params, JsHttpRequest: "1-xml" });
  return `${base}/server/load.php?${qs}`;
}

function stalkerHeaders(mac: string, token?: string): Record<string, string> {
  const h: Record<string, string> = {
    Cookie: `mac=${mac}; stb_lang=en; timezone=America%2FNew_York`,
    "X-User-Agent": "Model: MAG250; Link: WiFi",
    "User-Agent": "Mozilla/5.0 (QtEmbedded; U; Linux; C)",
    Accept: "application/json",
    "Accept-Language": "en-US,en;q=0.9",
  };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function doStalkerRequest(
  portal: string,
  mac: string,
  token: string | undefined,
  params: Record<string, string>
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const url = buildStalkerUrl(portal, params);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: stalkerHeaders(mac, token),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err: any) {
    return { ok: false, status: 502, body: { error: `Cannot reach portal: ${err?.message ?? "connection failed"}` } };
  }

  if (!response.ok) {
    return { ok: false, status: response.status, body: { error: `Portal returned ${response.status}` } };
  }

  const text = await response.text();
  if (!text.trim()) {
    return { ok: true, status: 200, body: { js: null } };
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { js: null, _raw: text.slice(0, 200) };
  }
  return { ok: true, status: 200, body: data };
}

router.get("/stalker/proxy", async (req, res) => {
  const { portal, mac, token, ...rest } = req.query as Record<string, string>;

  if (!portal || !mac) {
    res.status(400).json({ error: "portal and mac are required" });
    return;
  }

  const result = await doStalkerRequest(portal, mac, token || undefined, rest);
  res.status(result.status).json(result.body);
});

router.post("/stalker/proxy", async (req, res) => {
  const { portal, mac, token } = req.query as Record<string, string>;
  const bodyParams = req.body && typeof req.body === "object" ? req.body as Record<string, string> : {};
  const params = { ...bodyParams };

  if (!portal || !mac) {
    res.status(400).json({ error: "portal and mac are required" });
    return;
  }

  const result = await doStalkerRequest(portal, mac, token || undefined, params);
  res.status(result.status).json(result.body);
});

export default router;
