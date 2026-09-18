import {query} from '../artwork-jobs/_store';

export async function init(){
  await query(`CREATE TABLE IF NOT EXISTS test_jobs (
    id TEXT PRIMARY KEY,type TEXT NOT NULL,environment TEXT NOT NULL,status TEXT NOT NULL,
    created_at TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,game_id TEXT,name TEXT,provider TEXT,
    claimed_by TEXT,lease_expires INTEGER,result_json TEXT,completed_at TEXT
  )`);
  await query(`CREATE TABLE IF NOT EXISTS test_workers (
    worker_id TEXT PRIMARY KEY,worker_type TEXT NOT NULL,last_seen INTEGER NOT NULL,
    current_job_id TEXT,environment TEXT,version TEXT
  )`);
}
function row(r){if(!r)return null;return{id:r.id,type:r.type,environment:r.environment,status:r.status,createdAt:r.created_at,attempts:r.attempts,gameId:r.game_id,name:r.name,provider:r.provider,claimedBy:r.claimed_by,leaseExpires:r.lease_expires,result:r.result_json?JSON.parse(r.result_json):undefined,completedAt:r.completed_at}}
export async function createJob(input){await init();const id=crypto.randomUUID(),createdAt=new Date().toISOString();const type=input.type==='max_bet'?'max_bet':'gameplay_qa';const environment=input.environment==='uat'?'uat':'prod';await query('INSERT INTO test_jobs (id,type,environment,status,created_at,attempts,game_id,name,provider) VALUES (?,?,?,?,?,?,?,?,?)',[id,type,environment,'QUEUED',createdAt,0,input.gameId||'',input.name||'',input.provider||'']);return{id,type,environment,status:'QUEUED',createdAt,attempts:0,...input}}
export async function getJob(id){await init();const q=await query('SELECT * FROM test_jobs WHERE id=? LIMIT 1',[id]);return row(q?.[0]?.results?.[0])}
export async function listJobs(){await init();const q=await query('SELECT * FROM test_jobs ORDER BY created_at DESC LIMIT 100');return(q?.[0]?.results||[]).map(row)}
export async function claim(workerId,workerType){await init();const type=workerType==='max_bet'?'max_bet':'gameplay_qa',now=Date.now(),lease=now+300000;const q=await query("SELECT * FROM test_jobs WHERE type=? AND (status='QUEUED' OR (status='RUNNING' AND lease_expires<?)) ORDER BY created_at LIMIT 1",[type,now]);const j=q?.[0]?.results?.[0];if(!j)return null;await query("UPDATE test_jobs SET status='RUNNING',claimed_by=?,lease_expires=?,attempts=attempts+1 WHERE id=? AND (status='QUEUED' OR lease_expires<?)",[workerId,lease,j.id,now]);return getJob(j.id)}
export async function complete(id,workerId,result){await init();const verdict=['PASS','PASS_WITH_WARNING','NEEDS_REVIEW','FAILED'].includes(result?.status)?result.status:'FAILED',completedAt=new Date().toISOString();const q=await query("UPDATE test_jobs SET status=?,result_json=?,completed_at=?,lease_expires=NULL WHERE id=? AND claimed_by=? AND status='RUNNING' RETURNING *",[verdict,JSON.stringify(result||{}),completedAt,id,workerId]);return row(q?.[0]?.results?.[0])}
export async function heartbeat(input){await init();const now=Date.now();await query(`INSERT INTO test_workers(worker_id,worker_type,last_seen,current_job_id,environment,version) VALUES(?,?,?,?,?,?) ON CONFLICT(worker_id) DO UPDATE SET worker_type=excluded.worker_type,last_seen=excluded.last_seen,current_job_id=excluded.current_job_id,environment=excluded.environment,version=excluded.version`,[input.workerId,input.workerType,now,input.currentJobId||null,input.environment||null,input.version||'']);return{ok:true,lastSeen:now}}
export async function workers(){await init();const q=await query('SELECT * FROM test_workers ORDER BY last_seen DESC');return(q?.[0]?.results||[]).map(r=>({workerId:r.worker_id,workerType:r.worker_type,lastSeen:r.last_seen,currentJobId:r.current_job_id,environment:r.environment,version:r.version,online:Date.now()-r.last_seen<90000}))}
