import {createJob,getJob,listJobs} from './_store';
export async function POST(r){try{const b=await r.json();if(!b.name||!b.type)return Response.json({error:'name and type required'},{status:400});return Response.json(await createJob(b))}catch(e){return Response.json({error:e.message},{status:503})}}
export async function GET(r){try{const id=new URL(r.url).searchParams.get('id');return Response.json(id?await getJob(id):await listJobs())}catch(e){return Response.json({error:e.message},{status:503})}}
