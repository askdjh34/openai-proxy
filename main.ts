const UPSTREAM = "https://api.openai.com";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.pathname === "/health") return new Response("ok");

  const h = new Headers();
  for (const k of ["authorization", "content-type", "openai-organization", "openai-beta"]) {
    const v = req.headers.get(k);
    if (v) h.set(k, v);
  }

  const r = await fetch(UPSTREAM + url.pathname + url.search, {
    method: req.method,
    headers: h,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
  });

  const oh = new Headers(r.headers);
  oh.set("access-control-allow-origin", "*");
  oh.delete("content-encoding");
  oh.delete("content-length");
  return new Response(r.body, { status: r.status, headers: oh });
});
