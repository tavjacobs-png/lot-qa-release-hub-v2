const PROVIDERS = {
  "pragmatic play": "pragmaticplay.com",
  "big time gaming": "bigtimegaming.com",
  "blueprint": "blueprintgaming.com",
  "blueprint gaming": "blueprintgaming.com"
};

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("\\u0026", "&")
    .replaceAll("\\u003d", "=")
    .replaceAll("\\/", "/");
}

function extractImages(html, source, baseConfidence) {
  const out = [];
  const chunks = html.split(/src=|content=/i);
  for (const chunk of chunks) {
    const quote = chunk[0];
    if (quote !== '"' && quote !== "'") continue;
    const end = chunk.indexOf(quote, 1);
    if (end < 2) continue;
    let url = decodeHtml(chunk.slice(1, end));
    if (url.startsWith("//")) url = "https:" + url;
    if (!url.startsWith("http")) continue;
    const low = url.toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".webp"].some(ext => low.includes(ext))) continue;
    if (out.some(x => x.url === url)) continue;
    out.push({ url, source, confidence: Math.max(60, baseConfidence - out.length * 3) });
    if (out.length >= 6) break;
  }
  return out;
}

async function fetchText(url) {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" });
  if (!r.ok) return "";
  return await r.text();
}

export async function GET(request) {
  const u = new URL(request.url);
  const name = (u.searchParams.get("name") || "").trim();
  const provider = (u.searchParams.get("provider") || "").trim();
  if (!name) return Response.json({ candidates: [] }, { status: 400 });

  const candidates = [];
  const domain = PROVIDERS[provider.toLowerCase()];

  try {
    const searches = [];
    if (domain) searches.push({ q: 'site:' + domain + ' "' + name + '"', source: "Official provider", confidence: 98 });
    searches.push({ q: '"' + name + '" "' + provider + '" slot', source: "Web fallback", confidence: 82 });

    for (const search of searches) {
      const html = await fetchText("https://www.google.com/search?q=" + encodeURIComponent(search.q));
      const hrefParts = html.split("/url?q=");
      for (const part of hrefParts.slice(1, 8)) {
        const pageUrl = decodeURIComponent(part.split("&")[0]);
        if (!pageUrl.startsWith("http")) continue;
        if (search.source === "Official provider" && domain && !pageUrl.includes(domain)) continue;
        try {
          const page = await fetchText(pageUrl);
          const imgs = extractImages(page, search.source + " - " + new URL(pageUrl).hostname, search.confidence);
          for (const img of imgs) if (!candidates.some(x => x.url === img.url)) candidates.push(img);
          if (candidates.length >= 8) break;
        } catch {}
      }
      if (candidates.length >= 8) break;
    }

    return Response.json({ query: [name, provider].filter(Boolean).join(" - "), candidates: candidates.slice(0, 8) });
  } catch {
    return Response.json({ candidates: [], error: "search_unavailable" });
  }
}
