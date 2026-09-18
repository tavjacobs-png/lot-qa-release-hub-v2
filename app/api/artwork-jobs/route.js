import {createJob,getJob} from '../_store';
export async function POST(r){const b=await r.json();if(!b.tileUrl)return Response.json({error:'tileUrl required'},{status:400});return Response.json(createJob({gameId:b.gameId||'',name:b.name||'',provider:b.provider||'',tileUrl:b.tileUrl}))}
export async function GET(r){const id=new URL(r.url).searchParams.get('id');const j=getJob(id);return j?Response.json(j):Response.json({error:'not found'},{status:404})}
