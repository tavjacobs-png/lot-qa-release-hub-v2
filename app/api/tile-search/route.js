export async function GET(request){
  const {searchParams}=new URL(request.url);
  const name=(searchParams.get('name')||'').trim();
  const provider=(searchParams.get('provider')||'').trim();
  if(!name)return Response.json({candidates:[]},{status:400});
  const q=[name,provider,'slot game'].filter(Boolean).join(' ');
  try{
    const html=await fetch('https://www.google.com/search?tbm=isch&q='+encodeURIComponent(q),{headers:{'User-Agent':'Mozilla/5.0'}}).then(r=>r.text());
    const urls=[...html.matchAll(/https?:\\/\\/[^"'<> ]+?\\.(?:jpg|jpeg|png|webp)/gi)].map(m=>m[0].replace(/\\u003d/g,'=').replace(/\\u0026/g,'&'));
    const unique=[...new Set(urls)].filter(u=>!u.includes('gstatic.com')&&!u.includes('google.com')).slice(0,8);
    return Response.json({query:q,candidates:unique.map((url,i)=>({url,source:'Web image result',confidence:Math.max(60,90-i*4)}))});
  }catch(e){return Response.json({query:q,candidates:[],error:'search_unavailable'});}
}
