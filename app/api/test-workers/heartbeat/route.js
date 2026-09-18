import {heartbeat} from '../../test-jobs/_store';
function auth(r){const t=process.env.TEST_WORKER_TOKEN||process.env.ARTWORK_WORKER_TOKEN;return t&&r.headers.get('authorization')==='Bearer '+t}
export async function POST(r){if(!auth(r))return Response.json({error:'unauthorized'},{status:401});try{return Response.json(await heartbeat(await r.json()))}catch(e){return Response.json({error:e.message},{status:503})}}
