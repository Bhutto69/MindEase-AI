import os
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY", "")
TOGETHER_MODEL = os.getenv("TOGETHER_MODEL", "meta-llama/Llama-3.3-70B-Instruct-Turbo")
BOOKS_DIR = os.getenv("BOOKS_DIR", "./data/books")
CHROMA_DIR = os.getenv("CHROMA_DIR", "./data/chroma")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

ANALYST_MODEL = os.getenv("ANALYST_MODEL", TOGETHER_MODEL)
COMPANION_MAX_TOKENS = int(os.getenv("COMPANION_MAX_TOKENS", "350"))

# Comma-separated list of allowed frontend origins.
ALLOWED_ORIGINS = [o.strip() for o in os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173"
).split(",") if o.strip()]

# Optional shared code required to register. Empty = open registration.
ACCESS_CODE = os.getenv("ACCESS_CODE", "")