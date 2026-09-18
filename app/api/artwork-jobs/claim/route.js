import {claim} from '../_store';
export async function POST(r){const token=process.env.ARTWORK_WORKER_TOKEN;if(token&&r.headers.get('authorization')!=='Bearer '+token)return Response.json({error:'unauthorized'},{status:401});const b=await r.json();return Response.json({job:claim(b.workerId||'artwork-worker')})}
