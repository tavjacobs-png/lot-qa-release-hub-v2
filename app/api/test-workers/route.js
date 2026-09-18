import {workers} from '../test-jobs/_store';
export async function GET(){try{return Response.json(await workers())}catch(e){return Response.json({error:e.message},{status:503})}}
