const OPENAI = "https://api.openai.com";
const GITHUB = "https://github.com";

const ALLOW_HEADERS = ["authorization", "content-type", "accept", "openai-organization", "openai-beta"];

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (url.pathname === "/health") return new Response("ok");

  if (url.pathname.startsWith("/gh/")) {
    const target = GITHUB + url.pathname.slice(3) + url.search;
    const r = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" });
    return new Response(r.body, { status: r.status, headers: r.headers });
  }

  const h = new Headers();
  for (const k of ALLOW_HEADERS) {
    const v = req.headers.get(k);
    if (v) h.set(k, v);
  }

  const r = await fetch(OPENAI + url.pathname + url.search, {
    method: req.method,
    headers: h,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
    redirect: "manual",
  });

  const oh = new Headers(r.headers);
  oh.set("access-control-allow-origin", "*");
  oh.delete("content-encoding");
  oh.delete("content-length");
  return new Response(r.body, { status: r.status, headers: oh });
});
