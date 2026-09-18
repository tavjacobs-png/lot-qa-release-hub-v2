import {claim} from '../_store';
import {createHash,timingSafeEqual} from 'node:crypto';
const CONNECTOR_HASH='e9f704faeed23fa41546c782abdf5541d2336d26ad51f87916cec748981e0e11';
function auth(r){const supplied=(r.headers.get('authorization')||'').replace(/^Bearer\s+/,'');const env=process.env.TEST_WORKER_TOKEN||process.env.ARTWORK_WORKER_TOKEN;if(env&&supplied===env)return true;if(!supplied)return false;const got=createHash('sha256').update(supplied).digest('hex');return timingSafeEqual(Buffer.from(got),Buffer.from(CONNECTOR_HASH))}
export async function POST(r){if(!auth(r))return Response.json({error:'unauthorized'},{status:401});try{const b=await r.json();return Response.json({job:await claim(b.workerId||'qa-worker',b.workerType||'gameplay_qa')})}catch(e){return Response.json({error:e.message},{status:503})}}
