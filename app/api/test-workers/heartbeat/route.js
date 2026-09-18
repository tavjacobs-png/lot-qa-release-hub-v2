import {heartbeat} from '../../test-jobs/_store';
import {createHash,timingSafeEqual} from 'node:crypto';
const CONNECTOR_HASH='e9f704faeed23fa41546c782abdf5541d2336d26ad51f87916cec748981e0e11';
function auth(r){const supplied=(r.headers.get('authorization')||'').replace(/^Bearer\s+/,'');const env=process.env.TEST_WORKER_TOKEN||process.env.ARTWORK_WORKER_TOKEN;if(env&&supplied===env)return true;if(!supplied)return false;const got=createHash('sha256').update(supplied).digest('hex');return timingSafeEqual(Buffer.from(got),Buffer.from(CONNECTOR_HASH))}
export async function POST(r){if(!auth(r))return Response.json({error:'unauthorized'},{status:401});try{return Response.json(await heartbeat(await r.json()))}catch(e){return Response.json({error:e.message},{status:503})}}
