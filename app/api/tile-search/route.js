export async function GET(request) {
  const url = new URL(request.url);
  const name = (url.searchParams.get("name") || "").trim();
  const provider = (url.searchParams.get("provider") || "").trim();

  if (!name) {
    return Response.json({ candidates: [] }, { status: 400 });
  }

  const query = [name, provider, "slot game"].filter(Boolean).join(" ");

  try {
    const target = "https://www.google.com/search?tbm=isch&q=" + encodeURIComponent(query);
    const response = await fetch(target, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    const html = await response.text();

    const extensions = [".jpg", ".jpeg", ".png", ".webp"];
    const tokens = html.split('"');
    const found = [];

    for (const token of tokens) {
      if (!token.startsWith("http")) continue;
      const clean = token.split("&")[0];
      const lower = clean.toLowerCase();
      if (!extensions.some((ext) => lower.includes(ext))) continue;
      if (clean.includes("google.com") || clean.includes("gstatic.com")) continue;
      if (!found.includes(clean)) found.push(clean);
      if (found.length >= 8) break;
    }

    const candidates = found.map((imageUrl, index) => ({
      url: imageUrl,
      source: "Web image result",
      confidence: Math.max(60, 90 - index * 4)
    }));

    return Response.json({ query, candidates });
  } catch (error) {
    return Response.json({ query, candidates: [], error: "search_unavailable" });
  }
}
