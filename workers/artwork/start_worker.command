#!/bin/zsh
set -e
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "Artwork worker environment is missing. Run the one-time setup first."
  exit 1
fi

if [ ! -f ".env.local" ]; then
  echo "Missing workers/artwork/.env.local"
  echo "Create it once with: ARTWORK_WORKER_TOKEN=your-token"
  exit 1
fi

set -a
source .env.local
set +a

echo "Updating artwork worker..."
curl -fsSL "https://raw.githubusercontent.com/tavjacobs-png/lot-qa-release-hub-v2/main/workers/artwork/artwork_worker.py" -o artwork_worker.py.new
python3 -m py_compile artwork_worker.py.new
mv artwork_worker.py.new artwork_worker.py

source .venv/bin/activate
echo "Starting artwork worker..."
exec python artwork_worker.py --serve --hub "https://lot-qa-release-hub-v2.vercel.app"
