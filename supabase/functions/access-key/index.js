const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const TTL_MS = 7 * 24 * 60 * 60 * 1e3;
const enc = new TextEncoder();
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
function b64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function sign(data, secret) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}
function equal(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const accessKey = Deno.env.get("LURAPY_ACCESS_KEY")?.trim();
  const tokenSecret = Deno.env.get("LURAPY_TOKEN_SECRET");
  if (!accessKey || !tokenSecret) return json({ error: "unavailable" }, 503);
  const signingSecret = `${tokenSecret}:${accessKey}`;
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid" }, 400);
  }
  if (body.action === "login") {
    if (typeof body.key !== "string" || body.key.length === 0 || body.key.length > 128) return json({ ok: false });
    if (!equal(body.key.trim(), accessKey)) return json({ ok: false });
    const payload = String(Date.now() + TTL_MS);
    return json({ ok: true, token: `${payload}.${await sign(payload, signingSecret)}` });
  }
  if (body.action === "verify") {
    if (typeof body.token !== "string" || body.token.length > 256) return json({ ok: false });
    const [payload, sig] = body.token.split(".");
    if (!payload || !sig || !/^\d+$/.test(payload) || Number(payload) < Date.now()) return json({ ok: false });
    return equal(sig, await sign(payload, signingSecret)) ? json({ ok: true }) : json({ ok: false });
  }
  return json({ error: "invalid" }, 400);
});
