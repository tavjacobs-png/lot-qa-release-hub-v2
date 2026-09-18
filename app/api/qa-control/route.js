const CONTROL='https://slot-qa-control-centre.vercel.app/api/control';
export async function POST(req){
  try{
    const b=await req.json();
    const token=String(b.accessKey||process.env.SLOT_QA_CONTROL_ACCESS_KEY||'');
    if(!token)return Response.json({error:'Slot QA Control Centre access key is required'},{status:400});
    const action=String(b.action||'create_job');
    const payload=b.payload||{};
    const r=await fetch(CONTROL+'?action='+encodeURIComponent(action),{method:'POST',headers:{'content-type':'application/json','x-qa-token':token},body:JSON.stringify(payload),cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    return Response.json(j,{status:r.status});
  }catch(e){return Response.json({error:e.message||'Control Centre request failed'},{status:500})}
}
export async function GET(req){
  try{
    const token=req.headers.get('x-qa-token')||process.env.SLOT_QA_CONTROL_ACCESS_KEY||'';
    if(!token)return Response.json({error:'Slot QA Control Centre access key is required'},{status:400});
    const r=await fetch(CONTROL+'?action=bootstrap',{headers:{'x-qa-token':token},cache:'no-store'});
    const j=await r.json().catch(()=>({}));return Response.json(j,{status:r.status});
  }catch(e){return Response.json({error:e.message||'Control Centre request failed'},{status:500})}
}
