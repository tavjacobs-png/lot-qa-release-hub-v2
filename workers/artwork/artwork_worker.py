#!/usr/bin/env python3
"""QA Hub artwork worker: local, free open-vocabulary character detection.
Install once: pip install torch torchvision transformers pillow requests
Run: python artwork_worker.py --image-url URL
The web queue integration can call detect(url) and post its JSON result.
"""
import argparse, io, json, requests
from PIL import Image
import torch
from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection

MODEL="IDEA-Research/grounding-dino-tiny"
PROMPT="person. human. man. woman. fisherman. child. animal. fish. bird. dog. cat. horse. bear. monkey. gorilla. creature. monster. mascot. fictional character. anthropomorphic character."
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
    res=p.post_process_grounded_object_detection(outputs,inputs.input_ids,box_threshold=.22,text_threshold=.20,target_sizes=[im.size[::-1]])[0]
    boxes=[]
    for box,score,label in zip(res["boxes"],res["scores"],res["labels"]):
        x1,y1,x2,y2=[float(v) for v in box]
        boxes.append({"x":round(x1/im.width*100),"y":round(y1/im.height*100),"width":max(1,round((x2-x1)/im.width*100)),"height":max(1,round((y2-y1)/im.height*100)),"label":str(label),"confidence":round(float(score),3)})
    return {"status":"EDIT REQUIRED" if boxes else "NEEDS HUMAN REVIEW","characterBoxes":boxes,"findings":[f"{b['label']} ({round(b['confidence']*100)}%)" for b in boxes],"method":"Local Grounding DINO open-vocabulary detection"}

if __name__=="__main__":
    a=argparse.ArgumentParser();a.add_argument("--image-url",required=True);args=a.parse_args()
    print(json.dumps(detect(args.image_url),indent=2))
