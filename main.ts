const OPENAI = "https://api.openai.com";

const HOSTS: Record<string, string> = {
  gh: "https://github.com",
  raw: "https://raw.githubusercontent.com",
  assets: "https://github.githubassets.com",
  avatars: "https://avatars.githubusercontent.com",
  objects: "https://objects.githubusercontent.com",
};

const ALLOW_HEADERS = [
  "authorization", "content-type", "accept",
  "openai-organization", "openai-project", "openai-beta",
];

const PASS_HEADERS = ["accept", "accept-language", "range", "if-none-match", "if-modified-since"];

const INDEX = `<!doctype html><meta charset="utf-8"><title>proxy</title>
<style>body{font:15px/1.7 system-ui;margin:40px;max-width:720px}code{background:#f2f2f2;padding:2px 5px;border-radius:4px}</style>
<h2>可用路径</h2>
<ul>
<li><code>/gh/&lt;owner&gt;/&lt;repo&gt;</code> — GitHub 镜像（页面、文件浏览、releases）</li>
<li><code>/raw/&lt;owner&gt;/&lt;repo&gt;/&lt;branch&gt;/&lt;file&gt;</code> — 原始文件</li>
<li><code>/v1/...</code> — OpenAI API 透传</li>
<li><code>/health</code> — 健康检查</li>
</ul>
<p>例：<code>/gh/Derpyu520/qq-bridge</code></p>`;

function rewriteHtml(html: string): string {
  const map: Array<[string, string]> = [
    ["https://github.com", "/gh"],
    ["https://raw.githubusercontent.com", "/raw"],
    ["https://github.githubassets.com", "/assets"],
    ["https://avatars.githubusercontent.com", "/avatars"],
    ["https://objects.githubusercontent.com", "/objects"],
    ["https://user-images.githubusercontent.com", "/avatars"],
    ["https://private-user-images.githubusercontent.com", "/avatars"],
    ["//github.com", "/gh"],
  ];
  let out = html;
  for (const [from, to] of map) out = out.split(from).join(to);
  return out;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);

  if (url.pathname === "/health") return new Response("ok", { status: 200 });

  const m = url.pathname.match(/^\/(gh|raw|assets|avatars|objects)(\/.*)?$/);
  if (m) {
    const host = HOSTS[m[1]];
    const rest = m[2] ?? "/";
    const target = host + rest + url.search;

    const headers = new Headers();
    for (const k of PASS_HEADERS) {
      const v = req.headers.get(k);
      if (v) headers.set(k, v);
    }
    headers.set("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

    let upstream: Response;
    try {
      upstream = await fetch(target, {
        method: req.method === "HEAD" ? "HEAD" : "GET",
        headers,
        redirect: "follow",
      });
    } catch (err) {
      return new Response(`upstream error: ${err}`, { status: 502 });
    }

    const ctype = upstream.headers.get("content-type") ?? "";

    if (ctype.includes("text/html")) {
      const html = rewriteHtml(await upstream.text());
      const h = new Headers(upstream.headers);
      h.delete("content-length");
      h.delete("content-encoding");
      h.delete("content-security-policy");
      h.delete("content-security-policy-report-only");
      h.delete("strict-transport-security");
      h.delete("x-frame-options");
      h.set("content-type", "text/html; charset=utf-8");
      h.set("cache-control", "no-store");
      return new Response(html, { status: upstream.status, headers: h });
    }

    const h = new Headers(upstream.headers);
    h.delete("content-length");
    h.delete("content-encoding");
    h.set("access-control-allow-origin", "*");
    return new Response(upstream.body, { status: upstream.status, headers: h });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": ALLOW_HEADERS.join(", "),
        "access-control-allow-methods": "GET, POST, OPTIONS",
      },
    });
  }

  if (url.pathname === "/") {
    return new Response(INDEX, { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  // 非 /v1 的路径视为 GitHub 的绝对路径（如 /login、/search）
  if (!url.pathname.startsWith("/v1")) {
    return Response.redirect(new URL("/gh" + url.pathname + url.search, url), 302);
  }

  const oh2 = new Headers();
  for (const k of ALLOW_HEADERS) {
    const v = req.headers.get(k);
    if (v) oh2.set(k, v);
  }

  const init: RequestInit = { method: req.method, headers: oh2, redirect: "manual" };
  if (req.method !== "GET" && req.method !== "HEAD") init.body = await req.arrayBuffer();

  try {
    const r = await fetch(OPENAI + url.pathname + url.search, init);
    const oh = new Headers(r.headers);
    oh.set("access-control-allow-origin", "*");
    oh.delete("content-encoding");
    oh.delete("content-length");
    return new Response(r.body, { status: r.status, headers: oh });
  } catch (err) {
    return new Response(JSON.stringify({ error: { message: String(err) } }), {
      status: 502,
      headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    });
  }
});
