#!/usr/bin/env python3
"""QA Hub artwork worker: local, free open-vocabulary character detection.
Install once: pip install torch torchvision transformers pillow requests
Run: python artwork_worker.py --image-url URL
The web queue integration can call detect(url) and post its JSON result.
"""
import argparse, io, json, os, time, requests
from PIL import Image
import torch
from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection

MODEL="IDEA-Research/grounding-dino-tiny"
PROMPT="human person. fisherman. child. fish. animal. bird. dog. cat. horse. bear. monkey. gorilla. fantasy creature. monster. mascot. fictional character. anthropomorphic character."
_processor=None; _model=None

def load():
    global _processor,_model
    if _model is None:
        _processor=AutoProcessor.from_pretrained(MODEL)
        _model=AutoModelForZeroShotObjectDetection.from_pretrained(MODEL)
        _model.eval()
    return _processor,_model

def detect(url):
    r=requests.get(url,timeout=20,headers={"User-Agent":"Mozilla/5.0"}); r.raise_for_status()
    im=Image.open(io.BytesIO(r.content)).convert("RGB")
    p,m=load(); inputs=p(images=im,text=PROMPT,return_tensors="pt")
    with torch.no_grad(): outputs=m(**inputs)
    res=p.post_process_grounded_object_detection(outputs,inputs.input_ids,threshold=.22,text_threshold=.20,target_sizes=[im.size[::-1]])[0]
    boxes=[]
    for box,score,label in zip(res["boxes"],res["scores"],res["labels"]):
        x1,y1,x2,y2=[float(v) for v in box]
        boxes.append({"x":round(x1/im.width*100),"y":round(y1/im.height*100),"width":max(1,round((x2-x1)/im.width*100)),"height":max(1,round((y2-y1)/im.height*100)),"label":str(label),"confidence":round(float(score),3)})
    # Merge heavily-overlapping detections so synonyms do not create a giant destructive mask.
    boxes=sorted(boxes,key=lambda b:b["confidence"],reverse=True)
    kept=[]
    def overlap(a,b):
        ax1,ay1,ax2,ay2=a["x"],a["y"],a["x"]+a["width"],a["y"]+a["height"]
        bx1,by1,bx2,by2=b["x"],b["y"],b["x"]+b["width"],b["y"]+b["height"]
        inter=max(0,min(ax2,bx2)-max(ax1,bx1))*max(0,min(ay2,by2)-max(ay1,by1))
        small=max(1,min(a["width"]*a["height"],b["width"]*b["height"]))
        return inter/small
    for b in boxes:
        if b["confidence"]<.25: continue\n        # Suppress implausible low-confidence labels that commonly fire on stylised casino art.\n        if b["label"].lower() in {"horse","gorilla","monkey","bear","dog","cat","bird"} and b["confidence"]<.40: continue
        if any(overlap(b,k)>.70 for k in kept): continue
        kept.append(b)
    return {"status":"EDIT REQUIRED" if kept else "NEEDS HUMAN REVIEW","characterBoxes":kept,"findings":[f"{b['label']} ({round(b['confidence']*100)}%)" for b in kept],"method":"Local Grounding DINO open-vocabulary detection · overlap filtered"}

def serve(hub, token, worker_id="artwork-worker"):
    headers={"Authorization":"Bearer "+token,"Content-Type":"application/json"}
    print("Artwork worker online:",worker_id)
    while True:
        try:
            r=requests.post(hub.rstrip("/")+"/api/artwork-jobs/claim",headers=headers,json={"workerId":worker_id},timeout=20); r.raise_for_status()
            job=r.json().get("job")
            if not job: time.sleep(4); continue
            try: result=detect(job["tileUrl"])
            except Exception as e: result={"status":"NEEDS HUMAN REVIEW","characterBoxes":[],"findings":[str(e)],"method":"Local artwork worker error"}
            requests.post(hub.rstrip("/")+"/api/artwork-jobs/complete",headers=headers,json={"id":job["id"],"workerId":worker_id,"result":result},timeout=20).raise_for_status()
        except KeyboardInterrupt: break
        except Exception as e:
            print("Worker connection error:",e); time.sleep(8)

if __name__=="__main__":
    a=argparse.ArgumentParser();a.add_argument("--image-url");a.add_argument("--serve",action="store_true");a.add_argument("--hub",default=os.getenv("QA_HUB_URL","https://lot-qa-release-hub-v2.vercel.app"));a.add_argument("--token",default=os.getenv("ARTWORK_WORKER_TOKEN",""));args=a.parse_args()
    if args.serve:
        if not args.token: raise SystemExit("ARTWORK_WORKER_TOKEN is required")
        serve(args.hub,args.token)
    elif args.image_url: print(json.dumps(detect(args.image_url),indent=2))
    else: a.error("use --image-url URL or --serve")
