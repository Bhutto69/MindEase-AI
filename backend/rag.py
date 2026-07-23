from pathlib import Path
from typing import List, Optional

from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

from langchain_together import ChatTogether
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

from config import (BOOKS_DIR, CHROMA_DIR, EMBEDDING_MODEL, TOGETHER_MODEL,
                    ANALYST_MODEL, COMPANION_MAX_TOKENS)


# ---------------------------------------------------------------------------
# Cached singletons — load the embedding model & vector store ONCE, then reuse.
# (Previously these were rebuilt on every request, which made the first reply
#  slow and wasted memory.)
# ---------------------------------------------------------------------------
_embeddings_cache = None
_vectorstore_cache = None


import time

def _invoke_with_retry(llm, messages_or_prompt, max_retries=3):
    """Retry on Together AI 429s with backoff, per their documented guidance."""
    for attempt in range(max_retries):
        try:
            return llm.invoke(messages_or_prompt)
        except Exception as e:
            is_rate_limit = "429" in str(e) or "rate_limit" in str(e).lower()
            if is_rate_limit and attempt < max_retries - 1:
                wait = 2 * (attempt + 1)  # 2s, 4s, 6s
                print(f"[retry] 429 hit, waiting {wait}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait)
                continue
            raise


def _embeddings():
    global _embeddings_cache
    if _embeddings_cache is None:
        _embeddings_cache = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
    return _embeddings_cache


def get_vectorstore() -> Chroma:
    global _vectorstore_cache
    if _vectorstore_cache is None:
        Path(CHROMA_DIR).mkdir(parents=True, exist_ok=True)
        _vectorstore_cache = Chroma(
            persist_directory=CHROMA_DIR,
            embedding_function=_embeddings(),
            collection_name="mind_ease_books",
        )
    return _vectorstore_cache


# ---------------------------------------------------------------------------
# Book ingestion (unchanged behaviour, just uses the cached store)
# ---------------------------------------------------------------------------
def ingest_books() -> dict:
    books_path = Path(BOOKS_DIR)
    books_path.mkdir(parents=True, exist_ok=True)

    docs: List = []
    failed = []

    for p in books_path.rglob("*"):
        if not p.is_file():
            continue
        try:
            if p.suffix.lower() == ".pdf":
                docs.extend(PyPDFLoader(str(p)).load())
            elif p.suffix.lower() in [".txt", ".md"]:
                docs.extend(TextLoader(str(p), encoding="utf-8").load())
        except Exception as e:
            failed.append({"file": str(p), "error": str(e)})

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
    chunks = splitter.split_documents(docs)

    vs = get_vectorstore()

    batch_size = 200
    for i in range(0, len(chunks), batch_size):
        vs.add_documents(chunks[i:i + batch_size])

    return {
        "files_found": len([p for p in books_path.rglob("*") if p.is_file()]),
        "documents_loaded": len(docs),
        "chunks_added": len(chunks),
        "failed_files": failed,
    }


# ===========================================================================
# LLM #1 — THE COMPANION (the model that chats with the user)
# ===========================================================================
COMPANION_MODEL = TOGETHER_MODEL      # same base model...
COMPANION_TEMPERATURE = 0.7           # ...but warm & natural for conversation

COMPANION_SYSTEM_PROMPT = (
    "You are Mind Ease AI, a friendly companion for students. "
    "You talk like a genuine, easy-going friend — not a therapist, not a search engine.\n\n"
    "YOUR DEFAULT STANCE (very important):\n"
    "- Assume nothing is wrong. Do NOT treat the student as if they are sad, depressed, "
    "or anxious unless they clearly say or show they are struggling.\n"
    "- Match their energy. If they are casual, be casual. If they share good news or a "
    "win, be genuinely happy for them and chat about it. If they talk about an ordinary "
    "day, just have a normal, interested conversation.\n"
    "- Do NOT fish for problems. Never say things like 'you seem quiet, is everything "
    "okay?' to someone who hasn't shown any sign of distress. That makes people feel "
    "labelled. Just talk with them naturally.\n"
    "- Never imply the student is depressed or anxious, and never push exercises, "
    "coping techniques, or 'let's talk about your feelings' unprompted.\n\n"
    "WHEN TO LEAN IN:\n"
    "- Only when the student actually opens up about something difficult — stress, low "
    "mood, worry, loneliness, pressure — do you gently shift into a more supportive, "
    "caring mode and offer help. Follow their lead; let them set the depth.\n\n"
    "USING THE REFERENCE MATERIAL:\n"
    "- Trusted mental-health guide excerpts may be attached to the user's message.\n"
    "- Use them SILENTLY as background knowledge only when the student is genuinely "
    "seeking support. NEVER mention, quote, list, or refer to them, page numbers, or "
    "'the context'. The user must never know they exist.\n"
    "- If they are not relevant to what the student said, simply ignore them.\n\n"
   "GENERAL STYLE — TALK LIKE A FRIEND ON WHATSAPP:\n"
    "- Text like a real friend, not a counselor. Keep it short and casual.\n"
    "- Match the length and energy of the student. A short 'yo' gets a short, chill "
    "reply like 'yo, what's up?' or 'heyy, how's it going?' — NOT a long polished "
    "sentence and NOT formal openers like 'Let's start fresh' or 'What's new with you?'.\n"
    "- Only write longer, fuller replies when the student is actually sharing something "
    "real that deserves it.\n"
    "- Use easy, everyday words. Contractions, casual phrasing. It's fine to be brief.\n"
    "- Never invent facts about the student. Respond only to what they actually said.\n"
    "- You are not a doctor and never diagnose. If something serious comes up, gently "
    "suggest talking to someone they trust or a professional.\n\n"
    "CRISIS / SELF-HARM — READ CAREFULLY:\n"
    "- If the student expresses thoughts of self-harm, suicide, or not wanting to live, "
    "you must NEVER give a cold, clinical refusal, and NEVER say 'I cannot help with that.'\n"
    "- NEVER list United States or foreign hotlines (no 1-800 numbers, no Crisis Text Line, "
    "no National Suicide Prevention Lifeline). This is a Pakistani service.\n"
    "- Instead, stay warm and present like a caring friend who is NOT going anywhere. "
    "Acknowledge their pain gently, tell them you're here and you'll keep talking with them, "
    "and softly encourage reaching out to someone they trust. A help panel with Pakistani "
    "helplines is already shown to them by the app, so you do NOT need to list numbers — "
    "just be human, caring, and stay with them. Never abandon them.\n"
    "- Keep talking. The conversation must continue with warmth."

)


def _companion_llm() -> ChatTogether:
    return ChatTogether(model=COMPANION_MODEL, temperature=COMPANION_TEMPERATURE,
                        max_tokens=COMPANION_MAX_TOKENS)


from datetime import datetime
from zoneinfo import ZoneInfo

def current_date_note() -> str:
    """Fresh date/time line appended to the system prompt on every request,
    so the companion can answer 'what's today's date' naturally."""
    now = datetime.now(ZoneInfo("Asia/Karachi"))
    return (
        f"\n\nCURRENT DATE & TIME (Pakistan): {now.strftime('%A, %B %d, %Y, %I:%M %p')}. "
        "If the student asks about the date, day, year, or time, answer naturally from this. "
        "Never say you lack access to real-time information."
    )


def answer_with_rag(user_message: str, history: Optional[List[dict]] = None, support_hint: str = "") -> dict:
    """
    Foreground chat reply.
    `history` is a list of {"role": "user"|"assistant", "content": str}
    representing recent turns, so the companion stays consistent.
    """
    history = history or []

    # Always pull supporting context from the books
    trivial = len(user_message.split()) <= 3
    if trivial:
        context_docs, context = [], ""
    else:
        vs = get_vectorstore()
        context_docs = vs.as_retriever(search_kwargs={"k": 4}).invoke(user_message)
        context = "\n\n".join(d.page_content for d in context_docs)

    # Build the conversation: system prompt -> recent turns -> current message
    system_content = COMPANION_SYSTEM_PROMPT + current_date_note()
    if support_hint:
        system_content += f"\n\n[PRIVATE NOTE about this student right now — {support_hint}. Adjust your warmth and attention accordingly, but never mention this note.]"
    messages = [SystemMessage(content=system_content)]
    
    for turn in history:  # rolling memory window
        role = turn.get("role")
        content = (turn.get("content") or "").strip()
        if not content:
            continue
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))

    # Attach the retrieved material to the CURRENT message only, clearly marked
    # as private background the model must not talk about.
    if context.strip():
        final_human = (
            f"{user_message}\n\n"
            f"[PRIVATE BACKGROUND — do not mention or quote this to the user:]\n{context}"
        )
    else:
        final_human = user_message
    messages.append(HumanMessage(content=final_human))

    resp = _invoke_with_retry(_companion_llm(), messages)

    return {
        "reply": resp.content,
        "sources": [
            {"source": d.metadata.get("source", ""), "page": d.metadata.get("page", None)}
            for d in context_docs
        ],
    }


# ===========================================================================
# LLM #2 — THE ANALYST (background model for analytics / journal / library)
# Placeholder for the next phase. Same base model, but cold + JSON-only.
# We'll build this out once the companion chat is confirmed solid.
# ===========================================================================
# ANALYST_TEMPERATURE = 0.1
# def _analyst_llm() -> TogetherAI:
#     return TogetherAI (model=TogetherAI, temperature=ANALYST_TEMPERATURE)

import json

def analyze_conversation(history: list) -> dict:
    """LLM 2: reads the whole chat, builds a picture of the person's state over time.
    Tracks DSM-5 symptoms (depression + anxiety) as they appear naturally in conversation.
    Holds its read provisionally — accumulates evidence, does not decide on one message."""
    convo = "\n".join(f"{t['role']}: {t['content']}" for t in history if t.get("content"))
    if not convo.strip():
        return {"mood": "neutral", "signals": [], "needs_support": False,
                "symptoms": [], "confidence": "low"}

    llm = ChatTogether(model=ANALYST_MODEL, temperature=0)
    prompt = (
        "You silently analyze a student's ongoing chat to build a picture of their wellbeing "
        "over time. Base your read on the WHOLE conversation.\n"
        "TWO SEPARATE DECISIONS — do not confuse them:\n"
        "1) IS IT PRESENT? Be thorough. If the student describes the experience in ANY words, "
        "list the key — everyday phrasing counts, they will not use clinical terms. Only "
        "exclude it if they never referred to it at all. Do not guess or infer from mood.\n"
        "2) HOW OFTEN? Be conservative — see calibration below.\n"
        "A briefly-mentioned symptom is still PRESENT; it simply scores 1. Never omit a "
        "symptom because it sounds mild.\n\n"
        "Watch for these symptoms. Use these EXACT keys when present:\n"
        "Depression: loss_of_interest, depressed_mood, sleep_problems, fatigue, "
        "appetite_change, worthlessness_guilt, concentration_problems, psychomotor_change.\n"
        "Anxiety: nervous_anxious, uncontrollable_worry, excessive_worry, trouble_relaxing, "
        "restlessness, irritability, fear_awful.\n"
        "Stress: hard_to_wind_down, over_reactive, nervous_energy, agitated, "
        "difficult_to_relax, intolerant, touchy.\n"
        "HOW STUDENTS ACTUALLY PHRASE THESE:\n"
        "- 'skipping meals', 'not hungry', 'forgot to eat', 'eating way too much' "
        "-> appetite_change\n"
        "- 'brain wont shut off', 'lying awake', 'slept badly', 'up till 4am' -> sleep_problems\n"
        "- 'exhausted', 'no energy', 'tired all day', 'drained' -> fatigue\n"
        "- 'cant focus', 'reading the same page', 'zoning out', 'mind wanders' "
        "-> concentration_problems\n"
        "- 'not good enough', 'falling behind everyone', 'im useless', 'my fault' "
        "-> worthlessness_guilt\n"
        "- 'cant be bothered', 'dont enjoy anything', 'stopped going' -> loss_of_interest\n"
        "- 'snapping at people', 'everything annoys me' -> irritability\n"
        "- 'cant relax', 'cant switch off', 'always tense' -> trouble_relaxing "
        "AND difficult_to_relax\n"
        "- 'overthinking', 'worrying about everything', 'cant stop thinking about it' "
        "-> excessive_worry / uncontrollable_worry\n"
        "IMPORTANT: never include or probe thoughts of self-harm here — that is handled "
        "separately. Do not list any self-harm symptom.\n\n"
        "For each symptom present, rate frequency on the PHQ-9/GAD-7 scale: "
        "0=not present, 1=several days, 2=more than half the days, 3=nearly every day.\n"
        "CALIBRATION — follow strictly:\n"
        "- DEFAULT TO 1. Only go above 1 if the student states HOW OFTEN or HOW LONG.\n"
        "- Rate 3 ONLY if they say nearly every day, constantly, or for weeks.\n"
        "- Rate 2 ONLY with explicit frequency ('most days', 'all week', 'keeps happening').\n"
        "- Intensity is NOT frequency. Strong wording alone stays at 1.\n"
        "- EXAMPLE: 'i cant sleep, i cant relax, and i keep worrying about everything' -> "
        "every symptom scores 1, because no frequency or duration is given.\n"
        "- EXAMPLE: 'i havent slept properly in three weeks' -> 3.\n"
        "- When unsure, always rate lower.\n"
        "IMPORTANT — check EVERY scale independently. One statement often maps to items in "
        "more than one scale: 'cant relax' fits trouble_relaxing (Anxiety) AND "
        "difficult_to_relax + hard_to_wind_down (Stress). Score all that genuinely apply.\n\n"
        "SEPARATELY, set self_harm_risk to true ONLY if the student's own words "
        "express a thought of suicide or self-harm (including with typos, e.g. "
        "'kill muself'). Feeling sad, tired, stressed, unmotivated, or saying "
        "things like 'i feel like shit' is NOT self-harm — set it false for those. "
        "Only genuine ambiguity about wanting to die or hurt themselves counts as true.\n\n"
        "Return ONLY JSON, no extra text:\n"
        '{"mood": "positive|neutral|low", '
        '"signals": ["short phrases of what they actually said, else empty"], '
        '"symptoms": ["only the symptom keys clearly present in the conversation"], '
        '"severity": {"symptom_key": 0-3, ...only for present symptoms}, '
        '"confidence": "low|medium|high (how strongly the picture holds across the chat)", '
        '"needs_support": true/false, '
        '"self_harm_risk": true/false}\n\n'
        f"Conversation so far:\n{convo}"
    )
    try:
        raw = _invoke_with_retry(llm, prompt).content.strip().replace("```json", "").replace("```", "")
        data = json.loads(raw)
        # safety: never let a self-harm symptom slip through
        data["symptoms"] = [s for s in data.get("symptoms", []) if "harm" not in s and "suicid" not in s]
        sev = data.get("severity", {}) or {}
        data["severity"] = {k: v for k, v in sev.items() if "harm" not in k and "suicid" not in k}
        return data
    except Exception as e:
        print(f"[analyst] FAILED: {type(e).__name__}: {e}")
        return {"mood": "neutral", "signals": [], "needs_support": False,
                "symptoms": [], "severity": {}, "confidence": "low"}

def quick_crisis_check(text: str) -> bool:
    """Tiny, fast semantic crisis check — catches what the keyword list misses."""
    prompt = (
        "Does this message express a thought of suicide, self-harm, or not wanting to be "
        "alive? Typos count (e.g. 'kill muself'). Being sad, stressed, tired, unmotivated, "
        "or venting ('i feel like shit', 'this is killing me') is NOT self-harm.\n"
        "Answer with exactly one word: YES or NO.\n\nMessage: " + text
    )
    try:
        llm = ChatTogether(model=ANALYST_MODEL, temperature=0, max_tokens=3)
        out = _invoke_with_retry(llm, prompt, max_retries=1)
        return "yes" in out.content.strip().lower()
    except Exception as e:
        print(f"[quick_crisis] FAILED: {type(e).__name__}: {e}")
        return False

def summarize_session(convo_text: str) -> str:
    """One short, plain-language note about a single conversation."""
    if not convo_text.strip():
        return ""
    prompt = (
        "Below is one conversation between a student and a supportive companion.\n"
        "Write ONE sentence (max 25 words) describing what the student talked about "
        "and how they seemed.\n"
        "RULES: plain everyday words. No diagnosis, no clinical terms, no scores, no "
        "advice. Do not invent anything. If it was light chat, say so simply.\n\n"
        f"Conversation:\n{convo_text[:5000]}"
    )
    try:
        llm = ChatTogether(model=ANALYST_MODEL, temperature=0.3, max_tokens=60)
        return _invoke_with_retry(llm, prompt).content.strip()
    except Exception as e:
        print(f"[session-summary] FAILED: {e}")
        return ""