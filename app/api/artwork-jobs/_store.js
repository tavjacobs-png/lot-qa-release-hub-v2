const jobs=new Map();
const now=()=>Date.now();
export function createJob(input){const id=crypto.randomUUID();const j={id,type:'artwork_detection',status:'QUEUED',createdAt:new Date().toISOString(),attempts:0,...input};jobs.set(id,j);return j}
export function claim(workerId){for(const j of jobs.values()){if(j.type==='artwork_detection'&&(j.status==='QUEUED'||(j.status==='CLAIMED'&&(j.leaseExpires||0)<now()))){j.status='CLAIMED';j.claimedBy=workerId;j.leaseExpires=now()+120000;j.attempts=(j.attempts||0)+1;return j}}return null}
export function complete(id,workerId,result){const j=jobs.get(id);if(!j||j.claimedBy!==workerId)return null;j.status='DONE';j.result=result;j.completedAt=new Date().toISOString();return j}
export function getJob(id){return jobs.get(id)||null}
