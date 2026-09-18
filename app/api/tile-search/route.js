export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const name = (searchParams.get('name') || '').trim();
  const provider = (searchParams.get('provider') || '').trim();

  if (!name) {
    return Response.json({ candidates: [] }, { status: 400 });
  }

  const query = [name, provider, 'slot game'].filter(Boolean).join(' ');

  try {
    const searchUrl = 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(query);
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await response.text();

    const pattern = /https?:\\/\\/[^\\s"'<>]+?\\.(?:jpg|jpeg|png|webp)/gi;
    const matches = html.match(pattern) || [];
    const unique = Array.from(new Set(matches))
      .filter((url) => !url.includes('gstatic.com') && !url.includes('google.com'))
      .slice(0, 8);

    const candidates = unique.map((url, index) => ({
      url,
      source: 'Web image result',
      confidence: Math.max(60, 90 - index * 4)
    }));

    return Response.json({ query, candidates });
  } catch (error) {
    return Response.json({ query, candidates: [], error: 'search_unavailable' });
  }
}
