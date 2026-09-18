#!/usr/bin/env python3
"""QA Hub local test worker.

This adapter does not alter the frozen tester. It only claims jobs and launches
the configured local executable/script with the selected game/environment.
Credentials remain on this laptop in .env.local / the existing tester config.
"""
import argparse,json,os,subprocess,time,urllib.request,urllib.error
HUB_DEFAULT="https://lot-qa-release-hub-v2.vercel.app"
def req(hub,path,token,payload):
    data=json.dumps(payload).encode()
    r=urllib.request.Request(hub+path,data=data,headers={"Content-Type":"application/json","Authorization":"Bearer "+token})
    with urllib.request.urlopen(r,timeout=30) as x:return json.loads(x.read().decode())
def run_job(job,worker_type):
    env=os.environ.copy();env["QA_HUB_ENVIRONMENT"]=job["environment"];env["QA_HUB_GAME_NAME"]=job["name"];env["QA_HUB_GAME_ID"]=job.get("gameId") or "";env["QA_HUB_PROVIDER"]=job.get("provider") or ""
    key="GAMEPLAY_TESTER_PATH" if worker_type=="gameplay_qa" else "MAX_BET_TESTER_PATH"
    path=os.environ.get(key,"").strip()
    if not path:return {"status":"FAILED","reason":key+" is not configured on this laptop"}
    cmd=["python",path,"--game",job["name"],"--environment",job["environment"]]
    try:
        p=subprocess.run(cmd,env=env,text=True,capture_output=True,timeout=3600)
        out=(p.stdout or "")[-30000:];err=(p.stderr or "")[-10000:]
        # Frozen runner result packages remain authoritative; adapter never changes tester logic.
        status="PASS" if p.returncode==0 else "NEEDS_REVIEW"
        return {"status":status,"exitCode":p.returncode,"stdout":out,"stderr":err,"runnerPath":path}
    except subprocess.TimeoutExpired as e:return {"status":"NEEDS_REVIEW","reason":"Local tester timed out","stdout":(e.stdout or "")[-10000:] if isinstance(e.stdout,str) else ""}
    except Exception as e:return {"status":"FAILED","reason":str(e)}
def main():
    a=argparse.ArgumentParser();a.add_argument("--type",choices=["gameplay_qa","max_bet"],required=True);a.add_argument("--hub",default=HUB_DEFAULT);a.add_argument("--worker-id");args=a.parse_args()
    token=os.environ.get("TEST_WORKER_TOKEN") or os.environ.get("ARTWORK_WORKER_TOKEN")
    if not token:raise SystemExit("Missing TEST_WORKER_TOKEN/ARTWORK_WORKER_TOKEN in local environment")
    wid=args.worker_id or ("gameplay-qa-mac" if args.type=="gameplay_qa" else "max-bet-mac")
    print("QA Hub worker online:",wid,args.type,flush=True)
    while True:
        try:
            req(args.hub,"/api/test-workers/heartbeat",token,{"workerId":wid,"workerType":args.type,"version":"hub-adapter-1"})
            data=req(args.hub,"/api/test-jobs/claim",token,{"workerId":wid,"workerType":args.type});job=data.get("job")
            if not job:time.sleep(8);continue
            req(args.hub,"/api/test-workers/heartbeat",token,{"workerId":wid,"workerType":args.type,"currentJobId":job["id"],"environment":job["environment"],"version":"hub-adapter-1"})
            result=run_job(job,args.type)
            req(args.hub,"/api/test-jobs/complete",token,{"id":job["id"],"workerId":wid,"result":result})
        except KeyboardInterrupt:return
        except Exception as e:print("Worker loop:",e,flush=True);time.sleep(10)
if __name__=="__main__":main()
