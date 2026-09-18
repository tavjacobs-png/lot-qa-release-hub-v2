import {complete} from '../_store';
function auth(r){const t=process.env.TEST_WORKER_TOKEN||process.env.ARTWORK_WORKER_TOKEN;return t&&r.headers.get('authorization')==='Bearer '+t}
export async function POST(r){if(!auth(r))return Response.json({error:'unauthorized'},{status:401});try{const b=await r.json();const j=await complete(b.id,b.workerId,b.result||{});return j?Response.json(j):Response.json({error:'job not found or lease mismatch'},{status:409})}catch(e){return Response.json({error:e.message},{status:503})}}
