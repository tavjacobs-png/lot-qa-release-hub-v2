const PROVIDERS={
 "pragmatic play":{domain:"pragmaticplay.com",direct:n=>"https://www.pragmaticplay.com/en/games/"+slug(n)+"/"},
 "big time gaming":{domain:"bigtimegaming.com",direct:n=>"https://www.bigtimegaming.com/games/"+slug(n.replace(/ megaways$/i,""))},
 "blueprint":{domain:"blueprintgaming.com"},"blueprint gaming":{domain:"blueprintgaming.com"}
};
function slug(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
function words(s){return s.toLowerCase().replace(/megaways|slot|game/g," ").replace(/[^a-z0-9]+/g," ").trim().split(/\s+/).filter(x=>x.length>2)}
function clean(s){return s.replaceAll("&amp;","&").replaceAll("\\u0026","&").replaceAll("\\/","/")}
async function get(url,ms=4500){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0","Accept":"text/html"},redirect:"follow",signal:c.signal});return r.ok?{html:await r.text(),url:r.url}:{html:"",url:r.url}}catch{return{html:"",url}}finally{clearTimeout(t)}}
function pageTitle(html){for(const m of ["<h1",'<meta property="og:title" content="','<title>']){const p=html.toLowerCase().indexOf(m.toLowerCase());if(p<0)continue;const a=html.slice(p,p+600).replace(/<[^>]+>/g," ");return clean(a).replace(/\s+/g," ").trim()}return""}
function matchScore(name,pageUrl,title){const need=words(name),hay=words(decodeURIComponent(pageUrl)+" "+title);if(!need.length)return 0;const hit=need.filter(w=>hay.some(h=>h===w||h.includes(w)||w.includes(h))).length;return hit/need.length}
function imageMatch(name,url,context){const need=words(name),hay=words(decodeURIComponent(url)+" "+context);if(!need.length)return 0;return need.filter(w=>hay.some(h=>h===w||h.includes(w)||w.includes(h))).length/need.length}
function pageImages(html,name,source,base){
 const out=[];let pos=0;
 while((pos=html.toLowerCase().indexOf("<img",pos))>=0){
  const end=html.indexOf(">",pos);if(end<0)break;const tag=html.slice(pos,end+1);
  const src=(tag.match(/(?:src|data-src)=["']([^"']+)["']/i)||[])[1];
  const alt=(tag.match(/alt=["']([^"']*)["']/i)||[])[1]||"";
  if(src){let url=clean(src);if(url.startsWith("//"))url="https:"+url;if(url.startsWith("http")){const score=imageMatch(name,url,alt);const exact=score===1;if(exact&&!out.some(x=>x.url===url))out.push({url,source,confidence:Math.min(99,Math.round(base*score))})}}
  pos=end+1;
 }
 return out
}
function ddgLinks(html){const links=[];let pos=0;while((pos=html.indexOf("uddg=",pos))>=0){const start=pos+5;let end=html.indexOf("&",start);if(end<0)end=html.indexOf('"',start);if(end<0)break;try{const u=decodeURIComponent(html.slice(start,end));if(u.startsWith("http")&&!links.includes(u))links.push(u)}catch{}pos=end}return links}
export async function GET(request){
 const u=new URL(request.url),name=(u.searchParams.get("name")||"").trim(),provider=(u.searchParams.get("provider")||"").trim();
 if(!name)return Response.json({candidates:[]},{status:400});
 const candidates=[],cfg=PROVIDERS[provider.toLowerCase()];
 const diagnostics={aiConfigured:false,aiStatus:"not-run",imagesReturned:0,exactMatches:0,squareVerified:0};
 const aiKey=process.env.TAVILY_API_KEY;diagnostics.aiConfigured=!!aiKey;
 if(aiKey){try{const r=await fetch("https://api.tavily.com/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({api_key:aiKey,query:name+" "+provider+" casino square game tile",search_depth:"advanced",include_images:true,max_results:8})});diagnostics.aiStatus="http-"+r.status;if(r.ok){const d=await r.json();diagnostics.imagesReturned=(d.images||[]).length;for(const im of (d.images||[])){const url=typeof im==="string"?im:(im.url||im.image_url);const desc=typeof im==="string"?"":(im.description||"");if(url&&imageMatch(name,url,desc)===1){diagnostics.exactMatches++;if(!candidates.some(x=>x.url===url))candidates.push({url,source:"AI web search",confidence:99})}}}}catch(e){diagnostics.aiStatus="error-"+(e?.name||"unknown")}}
 async function inspect(url,source,base){
  try{const {html,url:finalUrl}=await get(url);if(!html)return;const title=pageTitle(html);const score=matchScore(name,finalUrl,title);if(score<0.75)return;for(const x of pageImages(html,name,source,base))if(!candidates.some(y=>y.url===x.url))candidates.push(x)}catch{}
 }
 if(!candidates.length&&cfg?.direct)await inspect(cfg.direct(name),"Official provider",99);
 if(!candidates.length){
  const q=(cfg?.domain?"site:"+cfg.domain+" ":"")+'"'+name+'" "'+provider+'"';
  try{const {html}=await get("https://html.duckduckgo.com/html/?q="+encodeURIComponent(q));for(const link of ddgLinks(html).slice(0,10)){if(cfg?.domain&&!link.includes(cfg.domain))continue;await inspect(link,cfg?.domain?"Official provider":"Web result",cfg?.domain?97:84);if(candidates.length>=6)break}}catch{}
 }
 if(!candidates.length){
  try{const {html}=await get("https://html.duckduckgo.com/html/?q="+encodeURIComponent('"'+name+'" "'+provider+'" slot'));for(const link of ddgLinks(html).slice(0,12)){await inspect(link,"Web fallback",82);if(candidates.length>=6)break}}catch{}
 }
 const verified=[];
 for(const c of candidates.slice(0,10)){
  try{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3500);const r=await fetch(c.url,{headers:{"User-Agent":"Mozilla/5.0","Accept":"image/*"},redirect:"follow",signal:controller.signal});clearTimeout(timer);
   if(!r.ok)continue;
   const b=new Uint8Array(await r.arrayBuffer());
   let w=0,h=0;
   if(b[0]===0x89&&b[1]===0x50&&b[2]===0x4e&&b[3]===0x47&&b.length>=24){w=(b[16]<<24)|(b[17]<<16)|(b[18]<<8)|b[19];h=(b[20]<<24)|(b[21]<<16)|(b[22]<<8)|b[23]}
   else if(b[0]===0xff&&b[1]===0xd8){let i=2;while(i+9<b.length){if(b[i]!==0xff){i++;continue}const m=b[i+1],len=(b[i+2]<<8)|b[i+3];if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(m)){h=(b[i+5]<<8)|b[i+6];w=(b[i+7]<<8)|b[i+8];break}i+=2+len}}
   else if(b.length>30&&String.fromCharCode(...b.slice(0,4))==="RIFF"&&String.fromCharCode(...b.slice(8,12))==="WEBP"){const kind=String.fromCharCode(...b.slice(12,16));if(kind==="VP8X"){w=1+b[24]+(b[25]<<8)+(b[26]<<16);h=1+b[27]+(b[28]<<8)+(b[29]<<16)}}
   if(w>0&&h>0&&w===h){verified.push({...c,width:w,height:h,aspect:"1:1"});if(c.source==="AI web search")diagnostics.squareVerified++;}
  }catch{}
 }
 return Response.json({query:name+" - "+provider,candidates:verified.slice(0,8),diagnostics});
}
