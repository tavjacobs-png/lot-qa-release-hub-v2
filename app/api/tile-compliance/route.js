const CHECKLIST = `
You are reviewing a UK online-casino game lobby tile for PRE-LOGIN display.
Return ONLY valid JSON with keys: status, reason, findings, humans, animals, fictionalCharacters, characterBoxes. humans, animals, and fictionalCharacters must each be booleans. characterBoxes must be an array containing one box for EVERY visible human, animal, creature, mascot or fictional/made-up character. Each box is {x,y,width,height} using integer percentages 0-100 of the full image, tightly covering that character. Include the whole character, not just the face.
status must be exactly PASS, EDIT REQUIRED, or NEEDS HUMAN REVIEW.
PASS only when the artwork clearly matches the named game and is suitable for pre-login.
EDIT REQUIRED when a specific removable visual element makes it unsuitable.
NEEDS HUMAN REVIEW when uncertain, ambiguous, the image is missing/blank, or game match cannot be verified.
Approve: official game artwork/logo; matches game; suitable pre-login; adult/fantasy/historical themes; standard casino imagery such as cards, dice, roulette, poker chips, slot symbols, gems, jackpot logos.
MANDATORY CHARACTER RULE: If ANY human/person, animal, anthropomorphic character, creature, monster, mascot, fictional character, fantasy being, or other made-up character is visible anywhere in the tile, status MUST be EDIT REQUIRED. This applies regardless of age, realism, art style, prominence, theme, or whether the character otherwise appears adult. The required edit is to remove every such character while preserving the game logo, background and other compliant artwork. Do not PASS a tile containing any character. Reject/flag: blank or missing artwork; child appeal; child-like cartoon characters; toy-style artwork; children's TV-style characters; school themes; teddy bears; anything designed to appeal to under-18s; sweets/candy presented with child appeal; easy-win messaging such as "Big Win", cash explosions or celebrating wins; excessive wealth such as large cash piles, money bags, gold bars, luxury cars, mansions, private jets, expensive jewellery/watches or champagne; nudity/sexual content; graphic violence/gore; alcohol, smoking or drugs; celebrity/influencer endorsement.
Illustration style alone is not a violation when no character is present. However, ANY depicted human, animal, creature, mascot, fictional or made-up character triggers EDIT REQUIRED under the mandatory character rule, even if it has no child appeal.
findings must be an array of concise specific observations. Human approval is always required after this scan.
`;
export async function POST(request){
 try{
  const {name,provider,tileUrl}=await request.json();
  if(!tileUrl||!/^https?:\/\//i.test(tileUrl)) return Response.json({error:'Missing valid tile URL'},{status:400});
  const key=process.env.OPENROUTER_API_KEY;
  if(!key) return Response.json({error:'OPENROUTER_API_KEY is not configured'},{status:503});
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),22000);
  try{
   const ir=await fetch(tileUrl,{headers:{'User-Agent':'Mozilla/5.0','Accept':'image/*'},redirect:'follow',signal:controller.signal});
   if(!ir.ok) return Response.json({error:'Could not download tile for vision scan: HTTP '+ir.status},{status:502});
   const type=(ir.headers.get('content-type')||'image/jpeg').split(';')[0];
   if(!type.startsWith('image/')) return Response.json({error:'Tile source did not return an image'},{status:502});
   const bytes=Buffer.from(await ir.arrayBuffer());
   if(bytes.length>8*1024*1024) return Response.json({error:'Tile is too large for vision scan'},{status:413});
   const image='data:'+type+';base64,'+bytes.toString('base64');
   const account=process.env.CLOUDFLARE_ACCOUNT_ID, token=process.env.CLOUDFLARE_AI_TOKEN;
   if(!account||!token) return Response.json({error:'Cloudflare AI is not configured'},{status:503});
   const od=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/ai/run/@cf/facebook/detr-resnet-50',{method:'POST',signal:controller.signal,headers:{Authorization:'Bearer '+token,'Content-Type':type},body:bytes});
   const oj=await od.json();
   if(!od.ok||oj?.success===false) return Response.json({error:oj?.errors?.[0]?.message||('Cloudflare object detection HTTP '+od.status)},{status:502});
   const detections=Array.isArray(oj?.result)?oj.result:Array.isArray(oj)?oj:[];
   const labels=detections.map(d=>String(d.label||d.class||d.name||'').toLowerCase());
   const animalLabels=new Set(['bird','cat','dog','horse','sheep','cow','elephant','bear','zebra','giraffe']);
   const humanDet=detections.filter(d=>String(d.label||d.class||d.name||'').toLowerCase()==='person');
   const animalDet=detections.filter(d=>animalLabels.has(String(d.label||d.class||d.name||'').toLowerCase()));
   const hard=[...humanDet,...animalDet];
   function boxOf(d){
    const b=d.box||d.bbox||d.bounding_box||{};
    let x=b.xmin??b.x??b.left, y=b.ymin??b.y??b.top, x2=b.xmax, y2=b.ymax, bw=b.width, bh=b.height;
    if(x==null||y==null) return null;
    if(x2!=null) bw=x2-x;if(y2!=null) bh=y2-y;
    if(bw==null||bh==null) return null;
    const scale=(Math.max(x,y,bw,bh)<=1.5);
    return {x:Math.round(scale?x*100:x/w*100),y:Math.round(scale?y*100:y/h*100),width:Math.round(scale?bw*100:bw/w*100),height:Math.round(scale?bh*100:bh/h*100)};
   }
   const boxes=hard.map(boxOf).filter(Boolean);
   if(hard.length){
    const kinds=[humanDet.length?'human/person':null,animalDet.length?'animal':null].filter(Boolean);
    return Response.json({status:'EDIT REQUIRED',reason:'Mandatory character rule: '+kinds.join(', ')+' detected by object detection. Remove all visible characters while preserving the game logo, background and other compliant artwork.',findings:hard.slice(0,12).map(d=>'Detected '+String(d.label||d.class||d.name)+' ('+Math.round(Number(d.score??d.confidence??0)*100)+'% confidence)'),characterBoxes:boxes,method:'Cloudflare DETR object detection → deterministic character rule · human approval required'});
   }
   const DETECT=`Inspect this casino tile. Identify ANY visible human/person, animal (especially fish), fictional/made-up character, mascot, monster, creature or anthropomorphic being. Return ONLY compact JSON: {"humans":true/false,"animals":true/false,"fictionalCharacters":true/false,"characterBoxes":[{"x":0,"y":0,"width":0,"height":0}],"observations":["..."]}. Coordinates are integer percentages 0-100. A tiny, partial, illustrated or logo-adjacent character counts.`;
   const vr=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/ai/run/@cf/google/gemma-4-26b-a4b-it',{method:'POST',signal:controller.signal,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:[{type:'text',text:DETECT+'\\nGame: '+(name||'Unknown')+'\\nProvider: '+(provider||'Unknown')},{type:'image_url',image_url:{url:image}}]}],max_tokens:350,temperature:0})});
   const vj=await vr.json();
   if(!vr.ok||vj?.success===false) return Response.json({status:'NEEDS HUMAN REVIEW',reason:'Object detector found no standard person/animal and the secondary vision check was unavailable.',findings:labels.length?['Objects seen: '+labels.join(', ')]:[],method:'Cloudflare DETR + safe fallback · human approval required'});
   const raw=vj?.result?.response??vj?.result?.choices?.[0]?.message?.content??vj?.response??'';
   function tolerant(raw){const s=String(raw||'').replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();try{return JSON.parse(s)}catch{}const a=s.indexOf('{'),b=s.lastIndexOf('}');if(a>=0&&b>a){try{return JSON.parse(s.slice(a,b+1))}catch{}}return null}
   const out=tolerant(raw);
   if(!out) return Response.json({status:'NEEDS HUMAN REVIEW',reason:'Object detector found no standard person/animal; secondary vision response was inconclusive.',findings:labels.length?['Objects seen: '+labels.join(', ')]:[],method:'Cloudflare DETR + Cloudflare vision · safe fallback · human approval required'});
   const findings=(Array.isArray(out.observations)?out.observations:[]).map(String).slice(0,12);
   const characterBoxes=Array.isArray(out.characterBoxes)?out.characterBoxes.filter(b=>b&&[b.x,b.y,b.width,b.height].every(Number.isFinite)).map(b=>({x:Math.max(0,Math.min(100,Math.round(b.x))),y:Math.max(0,Math.min(100,Math.round(b.y))),width:Math.max(1,Math.min(100,Math.round(b.width))),height:Math.max(1,Math.min(100,Math.round(b.height)))})).slice(0,12):[];
   if(out.humans===true||out.animals===true||out.fictionalCharacters===true){
    const kinds=[out.humans===true?'human/person':null,out.animals===true?'animal':null,out.fictionalCharacters===true?'fictional/made-up character':null].filter(Boolean);
    return Response.json({status:'EDIT REQUIRED',reason:'Mandatory character rule: '+kinds.join(', ')+' detected. Remove all visible characters while preserving the game logo, background and other compliant artwork.',findings,characterBoxes,method:'Cloudflare DETR + Cloudflare vision → deterministic character rule · human approval required'});
   }
   if(out.humans===false&&out.animals===false&&out.fictionalCharacters===false)return Response.json({status:'PASS',reason:'Two-stage Cloudflare detection found no human, animal or fictional/made-up characters. Other pre-login checks require human approval.',findings,method:'Cloudflare DETR + Cloudflare vision → deterministic hard rule · human approval required'});
   return Response.json({status:'NEEDS HUMAN REVIEW',reason:'Character detection was inconclusive.',findings,method:'Cloudflare two-stage detection · safe fallback · human approval required'});
  }finally{clearTimeout(timer)}
 }catch(e){return Response.json({error:e?.name==='AbortError'?'Vision scan timed out':('Vision scan unavailable: '+(e?.message||'unknown error'))},{status:502})}
}