const CHECKLIST = `
You are reviewing a UK online-casino game lobby tile for PRE-LOGIN display.
Return ONLY valid JSON with keys: status, reason, findings.
status must be exactly PASS, EDIT REQUIRED, or NEEDS HUMAN REVIEW.
PASS only when the artwork clearly matches the named game and is suitable for pre-login.
EDIT REQUIRED when a specific removable visual element makes it unsuitable.
NEEDS HUMAN REVIEW when uncertain, ambiguous, the image is missing/blank, or game match cannot be verified.
Approve: official game artwork/logo; matches game; suitable pre-login; adult/fantasy/historical themes; standard casino imagery such as cards, dice, roulette, poker chips, slot symbols, gems, jackpot logos.
Reject/flag: blank or missing artwork; child appeal; child-like cartoon characters; toy-style artwork; children's TV-style characters; school themes; teddy bears; anything designed to appeal to under-18s; sweets/candy presented with child appeal; easy-win messaging such as "Big Win", cash explosions or celebrating wins; excessive wealth such as large cash piles, money bags, gold bars, luxury cars, mansions, private jets, expensive jewellery/watches or champagne; nudity/sexual content; graphic violence/gore; alcohol, smoking or drugs; celebrity/influencer endorsement.
Do not reject merely because artwork is illustrated/cartoon-styled: assess whether it has CHILD appeal.
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
   const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',signal:controller.signal,headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json','HTTP-Referer':'https://lot-qa-release-hub-v2.vercel.app','X-Title':'Slot QA Release Hub'},body:JSON.stringify({model:'google/gemma-4-26b-a4b-it:free',messages:[{role:'user',content:[{type:'text',text:CHECKLIST+'\\nGame: '+(name||'Unknown')+'\\nProvider: '+(provider||'Unknown')},{type:'image_url',image_url:{url:image}}]}],temperature:0,max_tokens:500,response_format:{type:'json_object'}})});
   const data=await r.json();
   if(!r.ok) return Response.json({error:data?.error?.message||('OpenRouter HTTP '+r.status)},{status:502});
   const raw=data?.choices?.[0]?.message?.content||'';
   let out; try{out=JSON.parse(raw)}catch{const m=raw.match(/\{[\s\S]*\}/);out=m?JSON.parse(m[0]):null}
   if(!out||!['PASS','EDIT REQUIRED','NEEDS HUMAN REVIEW'].includes(out.status)) return Response.json({error:'Vision model returned an invalid compliance result'},{status:502});
   return Response.json({status:out.status,reason:String(out.reason||''),findings:Array.isArray(out.findings)?out.findings.map(String).slice(0,12):[],method:'OpenRouter vision · Gemma 4 26B free · human approval required'});
  }finally{clearTimeout(timer)}
 }catch(e){return Response.json({error:e?.name==='AbortError'?'Vision scan timed out':('Vision scan unavailable: '+(e?.message||'unknown error'))},{status:502})}
}