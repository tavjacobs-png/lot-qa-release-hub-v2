const PROVIDERS = {
  "pragmatic play": { domain: "pragmaticplay.com", direct: n => "https://www.pragmaticplay.com/en/games/" + slug(n) + "/" },
  "big time gaming": { domain: "bigtimegaming.com", direct: n => "https://www.bigtimegaming.com/games/" + slug(n.replace(/ megaways$/i, "")) },
  "blueprint": { domain: "blueprintgaming.com" },
  "blueprint gaming": { domain: "blueprintgaming.com" }
};

function slug(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
function clean(s){return s.replaceAll("&amp;","&").replaceAll("\\u0026","&").replaceAll("\\/","/")}
async function get(url){
  const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 (compatible; TileFinder/1.0)","Accept":"text/html"},redirect:"follow"});
  return r.ok?await r.text():"";
}
function metaImages(html,source,confidence){
  const out=[];
  for(const marker of ['property="og:image"','name="twitter:image"','property="twitter:image"']){
    const p=html.indexOf(marker); if(p<0) continue;
    const area=html.slice(Math.max(0,p-300),p+1200);
    const c=area.indexOf('content="'); if(c<0) continue;
    const start=c+9,end=area.indexOf('"',start); if(end<0) continue;
    let url=clean(area.slice(start,end)); if(url.startsWith("//"))url="https:"+url;
    if(url.startsWith("http")&&!out.some(x=>x.url===url))out.push({url,source,confidence});
  }
  return out;
}
function ddgLinks(html){
  const links=[]; const marker='uddg=';
  let pos=0;
  while((pos=html.indexOf(marker,pos))>=0){
    const start=pos+marker.length; let end=html.indexOf('&',start); if(end<0)end=html.indexOf('"',start);
    if(end<0)break;
    try{const u=decodeURIComponent(html.slice(start,end));if(u.startsWith("http")&&!links.includes(u))links.push(u)}catch{}
    pos=end;
  }
  return links;
}
export async function GET(request){
  const u=new URL(request.url),name=(u.searchParams.get("name")||"").trim(),provider=(u.searchParams.get("provider")||"").trim();
  if(!name)return Response.json({candidates:[]},{status:400});
  const candidates=[],cfg=PROVIDERS[provider.toLowerCase()];
  async function inspect(url,source,confidence){
    try{const html=await get(url);for(const x of metaImages(html,source,confidence))if(!candidates.some(y=>y.url===x.url))candidates.push(x)}catch{}
  }
  if(cfg?.direct)await inspect(cfg.direct(name),"Official provider",99);
  const q=(cfg?.domain?"site:"+cfg.domain+" ":"")+'"'+name+'" '+provider;
  try{
    const html=await get("https://html.duckduckgo.com/html/?q="+encodeURIComponent(q));
    for(const link of ddgLinks(html).slice(0,8)){
      if(cfg?.domain&&!link.includes(cfg.domain))continue;
      await inspect(link,cfg?.domain?"Official provider":"Web result",cfg?.domain?96:82);
      if(candidates.length>=6)break;
    }
    if(candidates.length===0){
      const fallback=await get("https://html.duckduckgo.com/html/?q="+encodeURIComponent('"'+name+'" "'+provider+'" slot'));
      for(const link of ddgLinks(fallback).slice(0,10)){
        await inspect(link,"Web fallback",80);
        if(candidates.length>=6)break;
      }
    }
  }catch{}
  return Response.json({query:name+" - "+provider,candidates:candidates.slice(0,8)});
}
