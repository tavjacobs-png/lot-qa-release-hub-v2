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
   const DETECT=`Inspect this casino game tile visually. Your FIRST and most important task is character detection.
List every visible: (1) human/person, (2) animal including fish, (3) fictional/made-up character, mascot, monster, creature or anthropomorphic being.
A tiny, partial, background, illustrated or logo-adjacent character still counts.
Return one compact JSON object only:
{"humans":true/false,"animals":true/false,"fictionalCharacters":true/false,"characterBoxes":[{"x":0,"y":0,"width":0,"height":0}],"observations":["..."]}
Coordinates are integer percentages 0-100 of the whole image, with one tight box per visible character. If a fisherman and a fish are visible, both must have boxes. Do not decide compliance. Do not omit obvious illustrated characters.`;
   const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',signal:controller.signal,headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json','HTTP-Referer':'https://lot-qa-release-hub-v2.vercel.app','X-Title':'Slot QA Release Hub'},body:JSON.stringify({model:'openrouter/free',messages:[{role:'user',content:[{type:'text',text:DETECT+'\\nGame: '+(name||'Unknown')+'\\nProvider: '+(provider||'Unknown')},{type:'image_url',image_url:{url:image}}]}],temperature:0,max_tokens:350})});
   const data=await r.json();
   if(!r.ok) return Response.json({error:(data?.error?.message||('OpenRouter HTTP '+r.status))+(data?.error?.metadata?.provider_name?' · provider: '+data.error.metadata.provider_name:'')},{status:502});
   const raw=data?.choices?.[0]?.message?.content||'';
   function tolerant(raw){
    if(raw&&typeof raw==='object') return raw;
    const s=String(raw||'').replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
    try{return JSON.parse(s)}catch{}
    const a=s.indexOf('{'),b=s.lastIndexOf('}'); if(a>=0&&b>a){try{return JSON.parse(s.slice(a,b+1))}catch{}}
    const low=s.toLowerCase();
    const yes=(words)=>words.some(w=>low.includes(w));
    const humans=yes(['human','person','people','man ','woman','fisherman','boy ','girl ']);
    const animals=yes(['animal','fish','bass','dog','cat','bird','horse','monkey','gorilla','bear','wolf','lion','tiger','shark']);
    const fictional=yes(['fictional','made-up','made up','mascot','creature','monster','anthropomorphic','fantasy being']);
    let status=low.includes('edit required')?'EDIT REQUIRED':low.includes('needs human review')?'NEEDS HUMAN REVIEW':low.includes('pass')?'PASS':(humans||animals||fictional?'EDIT REQUIRED':'NEEDS HUMAN REVIEW');
    const boxes=[];
    const re=/(?:x|left)\s*[:=]\s*(\d{1,3})[^\d]+(?:y|top)\s*[:=]\s*(\d{1,3})[^\d]+(?:width|w)\s*[:=]\s*(\d{1,3})[^\d]+(?:height|h)\s*[:=]\s*(\d{1,3})/gi; let m;
    while((m=re.exec(s))&&boxes.length<12) boxes.push({x:+m[1],y:+m[2],width:+m[3],height:+m[4]});
    return {status,reason:s.slice(0,600)||'Vision response could not be fully structured.',findings:s?[s.slice(0,300)]:[],humans,animals,fictionalCharacters:fictional,characterBoxes:boxes};
   }
   const out=tolerant(raw);
   const findings=(Array.isArray(out.observations)?out.observations:Array.isArray(out.findings)?out.findings:[]).map(String).slice(0,12);
   const combined=(String(out.reason||'')+' '+findings.join(' ')).toLowerCase();
   const detectedHuman=out.humans===true||/human|person|people|man\b|woman\b|boy\b|girl\b|fisherman|character/.test(combined);
   const detectedAnimal=out.animals===true||/animal|fish\b|bass\b|dog\b|cat\b|bird\b|horse\b|monkey|gorilla|bear\b|wolf\b|lion\b|tiger\b|shark\b/.test(combined);
   const detectedFictional=out.fictionalCharacters===true||/fictional|made-up|made up|mascot|creature|monster|fantasy being|anthropomorphic/.test(combined);
   if(detectedHuman||detectedAnimal||detectedFictional){
    const kinds=[detectedHuman?'human/person':null,detectedAnimal?'animal':null,detectedFictional?'fictional/made-up character':null].filter(Boolean);
    const characterBoxes=Array.isArray(out.characterBoxes)?out.characterBoxes.filter(b=>b&&[b.x,b.y,b.width,b.height].every(Number.isFinite)).map(b=>({x:Math.max(0,Math.min(100,Math.round(b.x))),y:Math.max(0,Math.min(100,Math.round(b.y))),width:Math.max(1,Math.min(100,Math.round(b.width))),height:Math.max(1,Math.min(100,Math.round(b.height)))})).slice(0,12):[]; return Response.json({status:'EDIT REQUIRED',reason:'Mandatory character rule: '+kinds.join(', ')+' detected. Remove all visible characters while preserving the game logo, background and other compliant artwork.',findings:[...findings,'Hard rule triggered: '+kinds.join(', ')].slice(0,12),characterBoxes,method:'OpenRouter vision detection + deterministic character-rule enforcement · human approval required'});
   }
   if(out.humans===false&&out.animals===false&&out.fictionalCharacters===false){
     return Response.json({status:'PASS',reason:'Character detection found no human, animal or fictional/made-up characters. Other pre-login checks require human approval.',findings,method:'OpenRouter character detection → deterministic hard rule · human approval required'});
   }
   return Response.json({status:'NEEDS HUMAN REVIEW',reason:'Character detector did not return a confident yes/no result.',findings,method:'OpenRouter character detection · safe fallback · human approval required'});
  }finally{clearTimeout(timer)}
 }catch(e){return Response.json({error:e?.name==='AbortError'?'Vision scan timed out':('Vision scan unavailable: '+(e?.message||'unknown error'))},{status:502})}
}