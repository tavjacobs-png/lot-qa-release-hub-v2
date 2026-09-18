const PROVIDERS={
 "pragmatic play":{domain:"pragmaticplay.com",direct:n=>"https://www.pragmaticplay.com/en/games/"+slug(n)+"/"},
 "big time gaming":{domain:"bigtimegaming.com",direct:n=>"https://www.bigtimegaming.com/games/"+slug(n.replace(/ megaways$/i,""))},
 "blueprint":{domain:"blueprintgaming.com"},"blueprint gaming":{domain:"blueprintgaming.com"}
};
function slug(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
function words(s){return s.toLowerCase().replace(/megaways|slot|game/g," ").replace(/[^a-z0-9]+/g," ").trim().split(/\s+/).filter(x=>x.length>2)}
function clean(s){return s.replaceAll("&amp;","&").replaceAll("\\u0026","&").replaceAll("\\/","/")}
async function get(url){const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0","Accept":"text/html"},redirect:"follow"});return r.ok?{html:await r.text(),url:r.url}:{html:"",url:r.url}}
function pageTitle(html){for(const m of ["<h1",'<meta property="og:title" content="','<title>']){const p=html.toLowerCase().indexOf(m.toLowerCase());if(p<0)continue;const a=html.slice(p,p+600).replace(/<[^>]+>/g," ");return clean(a).replace(/\s+/g," ").trim()}return""}
function matchScore(name,pageUrl,title){const need=words(name),hay=words(decodeURIComponent(pageUrl)+" "+title);if(!need.length)return 0;const hit=need.filter(w=>hay.some(h=>h===w||h.includes(w)||w.includes(h))).length;return hit/need.length}
function metaImages(html,source,confidence){const out=[];for(const marker of ['property="og:image"','name="twitter:image"','property="twitter:image"']){const p=html.indexOf(marker);if(p<0)continue;const area=html.slice(Math.max(0,p-350),p+1400);const c=area.indexOf('content="');if(c<0)continue;const start=c+9,end=area.indexOf('"',start);if(end<0)continue;let url=clean(area.slice(start,end));if(url.startsWith("//"))url="https:"+url;if(url.startsWith("http")&&!out.some(x=>x.url===url))out.push({url,source,confidence})}return out}
function ddgLinks(html){const links=[];let pos=0;while((pos=html.indexOf("uddg=",pos))>=0){const start=pos+5;let end=html.indexOf("&",start);if(end<0)end=html.indexOf('"',start);if(end<0)break;try{const u=decodeURIComponent(html.slice(start,end));if(u.startsWith("http")&&!links.includes(u))links.push(u)}catch{}pos=end}return links}
export async function GET(request){
 const u=new URL(request.url),name=(u.searchParams.get("name")||"").trim(),provider=(u.searchParams.get("provider")||"").trim();
 if(!name)return Response.json({candidates:[]},{status:400});
 const candidates=[],cfg=PROVIDERS[provider.toLowerCase()];
 async function inspect(url,source,base){
  try{const {html,url:finalUrl}=await get(url);if(!html)return;const title=pageTitle(html);const score=matchScore(name,finalUrl,title);if(score<0.75)return;const confidence=Math.min(99,Math.round(base*score));for(const x of metaImages(html,source,confidence))if(!candidates.some(y=>y.url===x.url))candidates.push(x)}catch{}
 }
 if(cfg?.direct)await inspect(cfg.direct(name),"Official provider",99);
 if(!candidates.length){
  const q=(cfg?.domain?"site:"+cfg.domain+" ":"")+'"'+name+'" "'+provider+'"';
  try{const {html}=await get("https://html.duckduckgo.com/html/?q="+encodeURIComponent(q));for(const link of ddgLinks(html).slice(0,10)){if(cfg?.domain&&!link.includes(cfg.domain))continue;await inspect(link,cfg?.domain?"Official provider":"Web result",cfg?.domain?97:84);if(candidates.length>=6)break}}catch{}
 }
 if(!candidates.length){
  try{const {html}=await get("https://html.duckduckgo.com/html/?q="+encodeURIComponent('"'+name+'" "'+provider+'" slot'));for(const link of ddgLinks(html).slice(0,12)){await inspect(link,"Web fallback",82);if(candidates.length>=6)break}}catch{}
 }
 return Response.json({query:name+" - "+provider,candidates:candidates.slice(0,8)});
}
