from pathlib import Path

from dotenv import load_dotenv

# Repo root: shared/py/src/journey_shared/env.py → parents[4]
ROOT_DIR = Path(__file__).resolve().parents[4]

# Load the root .env once, before anything reads os.environ.
# Every other shared module imports this one first.
load_dotenv(ROOT_DIR / ".env")
