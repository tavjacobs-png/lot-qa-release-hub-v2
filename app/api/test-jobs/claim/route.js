import {claim} from '../_store';
function auth(r){const t=process.env.TEST_WORKER_TOKEN||process.env.ARTWORK_WORKER_TOKEN;return t&&r.headers.get('authorization')==='Bearer '+t}
export async function POST(r){if(!auth(r))return Response.json({error:'unauthorized'},{status:401});try{const b=await r.json();return Response.json({job:await claim(b.workerId||'qa-worker',b.workerType||'gameplay_qa')})}catch(e){return Response.json({error:e.message},{status:503})}}
