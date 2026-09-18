# Artwork Detection Worker

This worker is the free local detection stage for the QA Release Hub. It uses Grounding DINO locally so a cloud LLM is never allowed to PASS artwork merely because it missed a character.

## One-time install (Mac)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install torch torchvision transformers pillow requests
```

## Test the detector

```bash
source .venv/bin/activate
python artwork_worker.py --image-url "DIRECT_TILE_URL"
```

The first run downloads the Grounding DINO model. Later runs reuse the local cache.

Output contains `characterBoxes` in 0–100 percentage coordinates. Any detected person, animal, fish, mascot, creature or fictional character produces `EDIT REQUIRED`. A negative result stays `NEEDS HUMAN REVIEW`; it never becomes PASS automatically.

Next integration stage: persistent worker polling the QA Hub job queue and returning these boxes to the game record for Cloudflare inpainting.
