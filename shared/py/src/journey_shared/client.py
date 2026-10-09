from openai import OpenAI

from . import env  # noqa: F401  (loads .env before creating the client)

# One client for the whole process. It reads OPENAI_API_KEY from os.environ.
client = OpenAI()
