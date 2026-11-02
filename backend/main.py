import bcrypt
from fastapi import FastAPI, Depends, Header, HTTPException
from langchain_together import ChatTogether
from pydantic import BaseModel
from typing import List, Optional
import random, string
import base64, hashlib, hmac, secrets, time

from rag import ingest_books, answer_with_rag, analyze_conversation
from safety import is_crisis, crisis_message
from fastapi.middleware.cors import CORSMiddleware
from storage import init_db, save_message, get_messages, save_analysis, get_analyses, list_sessions, get_session_messages, save_journal, get_journal, create_user, get_user, set_nickname, update_password, log_practice, save_feedback, get_admin_stats, get_all_user_ids, get_anon_assessments, change_user_id, is_admin_user, get_admin_extra, set_security, get_security_question, get_security_hash, clear_user_data, delete_user_forever, delete_cancelled_message, init_summaries
app = FastAPI(title="Mind Ease AI Backend")
init_db()
init_summaries()

from rag import get_vectorstore
get_vectorstore()  # preload embeddings so the first chat isn't slow

from fastapi.responses import StreamingResponse
import json as _json
from questionnaire import QUESTIONNAIRE, KEYS
from datetime import datetime
from config import ALLOWED_ORIGINS, ACCESS_CODE, TOGETHER_MODEL, SECRET_KEY

# ---- Login tokens ----
# Signed "user_id|expiry" tokens issued at login/register and sent back in the
# X-Auth-Token header. Without SECRET_KEY a random key is used, so tokens reset
# whenever the server restarts.
_TOKEN_KEY = (SECRET_KEY or secrets.token_hex(32)).encode()
TOKEN_TTL = 7 * 24 * 3600

def make_token(user_id: str) -> str:
    msg = f"{user_id}|{int(time.time()) + TOKEN_TTL}"
    sig = hmac.new(_TOKEN_KEY, msg.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{msg}|{sig}".encode()).decode()

def token_user(token: str) -> Optional[str]:
    try:
        user_id, exp, sig = base64.urlsafe_b64decode(token.encode()).decode().rsplit("|", 2)
    except Exception:
        return None
    good = hmac.new(_TOKEN_KEY, f"{user_id}|{exp}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, good) or int(exp) < time.time():
        return None
    return user_id

def current_user(x_auth_token: str = Header(default="")) -> str:
    user_id = token_user(x_auth_token)
    if not user_id or not get_user(user_id):
        raise HTTPException(status_code=401, detail="Please log in again.")
    return user_id

def require_admin(user_id: str = Depends(current_user)) -> str:
    if not is_admin_user(user_id):
        raise HTTPException(status_code=403, detail="Admins only.")
    return user_id

def optional_user(x_auth_token: str = Header(default="")) -> Optional[str]:
    return token_user(x_auth_token) if x_auth_token else None

def check_owner(user_id: Optional[str], auth: Optional[str]):
    """Users may only touch their own data. Admins may also use the TEST-
    accounts they create from the admin panel."""
    if not user_id or user_id == auth:
        return
    if not auth:
        raise HTTPException(status_code=401, detail="Please log in again.")
    if not (user_id.startswith("TEST-") and is_admin_user(auth)):
        raise HTTPException(status_code=403, detail="Not allowed.")

# ---- Attempt limits ----
# At most MAX_FAILS wrong passwords/answers per account in LOCK_WINDOW seconds.
MAX_FAILS = 5
LOCK_WINDOW = 15 * 60
_FAILS: dict = {}

def is_locked(user_id: str) -> bool:
    now = time.time()
    _FAILS[user_id] = [t for t in _FAILS.get(user_id, []) if now - t < LOCK_WINDOW]
    return len(_FAILS[user_id]) >= MAX_FAILS

def record_fail(user_id: str):
    _FAILS.setdefault(user_id, []).append(time.time())

LOCKED = {"ok": False, "error": "Too many attempts. Try again in 15 minutes."}


# Message ids cancelled by the user (Stop button), keyed per message so that
# stopping one message can never affect another one sent right after it.
# Checked in /chat before saving the reply.
CANCELLED_MSG_IDS = set()
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Turn(BaseModel):
    role: str          # "user" or "assistant"
    content: str


class ChatIn(BaseModel):
    message: str
    history: Optional[List[Turn]] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    msg_id: Optional[str] = None


class AnalyzeIn(BaseModel):
    history: Optional[List[Turn]] = None
    user_id: Optional[str] = None


class JournalIn(BaseModel):
    user_id: str
    content: str
    mood: Optional[str] = ""

class RegisterIn(BaseModel):
    user_id: str
    nickname: Optional[str] = ""


class RegisterIn(BaseModel):
    user_id: str
    password: str
    nickname: Optional[str] = ""
    question: Optional[str] = ""
    answer: Optional[str] = ""
    access_code: Optional[str] = ""


class LoginIn(BaseModel):
    user_id: str
    password: str

class ChangePwIn(BaseModel):
    user_id: str
    old_password: str
    new_password: str


class UserActionIn(BaseModel):
    user_id: str
    password: str

class PracticeIn(BaseModel):
    user_id: str
    practice: str
    session_id: Optional[str] = None

class FeedbackIn(BaseModel):
    user_id: str
    rating: int
    comment: Optional[str] = ""   

class NicknameIn(BaseModel):
    user_id: str
    nickname: str 

class ChangeIdIn(BaseModel):
    old_id: str
    new_id: str

class SecuritySetIn(BaseModel):
    user_id: str
    question: str
    answer: str

class ForgotQIn(BaseModel):
    user_id: str

class ForgotResetIn(BaseModel):
    user_id: str
    answer: str
    new_password: str    

class VerifyAnswerIn(BaseModel):
    user_id: str
    answer: str

class SecureActionIn(BaseModel):
    user_id: str
    answer: str
    action: str  # "clear" or "delete"


class CancelIn(BaseModel):
    user_id: str
    session_id: Optional[str] = None
    msg_id: Optional[str] = None

class CheckInIn(BaseModel):
    user_id: str
    mood: str          # super | happy | meh | stressed

class TestUserIn(BaseModel):
    previous_id: str | None = None

class EndSessionIn(BaseModel):
    user_id: str
    session_id: str


@app.post("/cancel")
def cancel(payload: CancelIn, auth: Optional[str] = Depends(optional_user)):
    """User pressed Stop on one specific message. Flag that message id so an
    in-flight /chat call for it won't save its reply, and delete whatever was
    already persisted for it (user message, reply, analysis)."""
    check_owner(payload.user_id, auth)
    if payload.user_id and payload.msg_id:
        CANCELLED_MSG_IDS.add((payload.user_id, payload.msg_id))
        delete_cancelled_message(payload.user_id, payload.session_id, payload.msg_id)
    return {"ok": True}

@app.post("/change-id")
def change_id(payload: ChangeIdIn, user_id: str = Depends(current_user)):
    if user_id != payload.old_id:
        raise HTTPException(status_code=403, detail="You can only change your own ID.")
    ok = change_user_id(payload.old_id, payload.new_id)
    if not ok:
        return {"ok": False, "error": "That ID already exists."}
    return {"ok": True, "error": "", "token": make_token(payload.new_id)}

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ingest")
def ingest():
    return ingest_books()


@app.post("/chat")
def chat(payload: ChatIn, auth: Optional[str] = Depends(optional_user)):
    check_owner(payload.user_id, auth)
    if payload.user_id:
        save_message(payload.user_id, "user", payload.message, payload.session_id, payload.msg_id)

    history = [t.model_dump() for t in payload.history] if payload.history else []

    journal_context = []
    if payload.user_id:
        entries = get_journal(payload.user_id)[:10]
        journal_context = [{"role": "user", "content": f"(journal) {e['content']}"} for e in reversed(entries)]

    recent_practice = None
    prior_analyses = []
    session_count = 1 
    if payload.user_id:
        prior_analyses = get_analyses(payload.user_id)
        recent_msgs = get_messages(payload.user_id, limit=8)
        session_count = len(list_sessions(payload.user_id))
        for m in reversed(recent_msgs):
            if m["role"] == "system" and "completed a wellbeing practice" in m["content"]:
                recent_practice = m["content"].split(": ", 1)[-1].rstrip("]")
                break

    # ===== AGENT (LangGraph) MODE =====
    from agent_graph import run_graph
    result = run_graph(payload.message, history, journal_context, payload.user_id, prior_analyses, recent_practice, session_count)
    read = result.get("read", {})
    crisis_flag = result["crisis"]

    # ===== OLD PIPELINE MODE (kept for comparison — commented) =====
    # read = analyze_conversation(journal_context + history + [{"role": "user", "content": payload.message}])
    # ...old routing/hint code...
    # result = answer_with_rag(payload.message, history, support_hint=(hint + tone_rule + practice_note))

    if payload.user_id:
        # If THIS specific message was cancelled while we were generating,
        # /cancel already deleted it — don't save the reply or analysis.
        cancel_key = (payload.user_id, payload.msg_id)
        if payload.msg_id and cancel_key in CANCELLED_MSG_IDS:
            CANCELLED_MSG_IDS.discard(cancel_key)
            # /cancel may have run before our save_message above landed;
            # delete again by id — it can only ever touch this one message.
            delete_cancelled_message(payload.user_id, payload.session_id, payload.msg_id)
            return {"reply": "", "sources": [], "crisis": False, "cancelled": True}

        save_message(payload.user_id, "assistant", result["reply"], payload.session_id, payload.msg_id)
        sig = (["crisis_flag"] + list(read.get("signals", []))) if crisis_flag else read.get("signals", [])
        save_analysis(payload.user_id, read.get("mood", "neutral"),
                      sig, read.get("needs_support", False),
                      read.get("symptoms", []), read.get("severity", {}),
                      payload.session_id, payload.msg_id)
    result["picture"] = result.get("picture")
    result["primary"] = result.get("primary") 

    return result

@app.post("/chat/stream")
def chat_stream(payload: ChatIn, auth: Optional[str] = Depends(optional_user)):
    check_owner(payload.user_id, auth)
    if payload.user_id:
        save_message(payload.user_id, "user", payload.message,
                     payload.session_id, payload.msg_id)

    history = [t.model_dump() for t in payload.history] if payload.history else []
    journal_context, prior_analyses, recent_practice, session_count = [], [], None, 1
    if payload.user_id:
        entries = get_journal(payload.user_id)[:10]
        journal_context = [{"role": "user", "content": f"(journal) {e['content']}"}
                           for e in reversed(entries)]
        prior_analyses = get_analyses(payload.user_id)
        session_count = len(list_sessions(payload.user_id))
        for m in reversed(get_messages(payload.user_id, limit=8)):
            if m["role"] == "system" and "completed a wellbeing practice" in m["content"]:
                recent_practice = m["content"].split(": ", 1)[-1].rstrip("]")
                break

    def gen():
        from agent_graph import run_graph_stream
        final = None
        for kind, data in run_graph_stream(payload.message, history, journal_context,
                                           payload.user_id, prior_analyses,
                                           recent_practice, session_count):
            if kind == "done":
                final = data
            yield f"data: {_json.dumps({'type': kind, 'data': data})}\n\n"

        if payload.user_id and final:
            cancel_key = (payload.user_id, payload.msg_id)
            if payload.msg_id and cancel_key in CANCELLED_MSG_IDS:
                CANCELLED_MSG_IDS.discard(cancel_key)
                delete_cancelled_message(payload.user_id, payload.session_id, payload.msg_id)
                return
            save_message(payload.user_id, "assistant", final["reply"],
                         payload.session_id, payload.msg_id)
            read = final.get("read", {})
            sig = (["crisis_flag"] + list(read.get("signals", []))) if final["crisis"] \
                  else read.get("signals", [])
            save_analysis(payload.user_id, read.get("mood", "neutral"), sig,
                          read.get("needs_support", False), read.get("symptoms", []),
                          read.get("severity", {}), payload.session_id, payload.msg_id)

    return StreamingResponse(gen(), media_type="text/event-stream")

@app.post("/analyze")
def analyze(payload: AnalyzeIn, auth: Optional[str] = Depends(optional_user)):
    check_owner(payload.user_id, auth)
    history = [t.model_dump() for t in payload.history] if payload.history else []
    result = analyze_conversation(history)
    if payload.user_id:
        save_analysis(payload.user_id, result["mood"], result["signals"], result["needs_support"])
    return result

@app.get("/history/{user_id}")
def history(user_id: str, auth: Optional[str] = Depends(optional_user)):
    check_owner(user_id, auth)
    return {"messages": get_messages(user_id, limit=50)}

@app.get("/analytics/{user_id}")
def analytics(user_id: str, auth: Optional[str] = Depends(optional_user)):
    check_owner(user_id, auth)
    return {"analyses": get_analyses(user_id)}

@app.get("/sessions/{user_id}")
def sessions(user_id: str, auth: Optional[str] = Depends(optional_user)):
    check_owner(user_id, auth)
    return {"sessions": list_sessions(user_id)}

@app.get("/session/{user_id}/{session_id}")
def session_messages(user_id: str, session_id: str, auth: Optional[str] = Depends(optional_user)):
    check_owner(user_id, auth)
    return {"messages": get_session_messages(user_id, session_id)}

@app.post("/crisis-event")
def crisis_event(payload: ChatIn, auth: Optional[str] = Depends(optional_user)):
    check_owner(payload.user_id, auth)
    if payload.user_id:
        save_message(payload.user_id, "system", "[User manually opened the crisis support panel]", payload.session_id)
        save_analysis(payload.user_id, "low", ["manually opened crisis support"], True)
        save_analysis(payload.user_id, "low", ["crisis_flag", "manually opened crisis support"], True)
    return {"ok": True}

@app.post("/journal")
def journal_save(payload: JournalIn, auth: Optional[str] = Depends(optional_user)):
    check_owner(payload.user_id, auth)
    # crisis check on the entry (gentle handling in the journal)
    crisis_flag = is_crisis(payload.content)
    save_journal(payload.user_id, payload.content, payload.mood)
    # Analyst reads the journal entry and feeds the assessment
    read = analyze_conversation([{"role": "user", "content": payload.content}])
    sig = (["crisis_flag"] + list(read.get("signals", []))) if crisis_flag else read.get("signals", [])
    save_analysis(payload.user_id, read.get("mood", "neutral"),
                  sig, read.get("needs_support", False),
                  read.get("symptoms", []), read.get("severity", {}))
    return {"ok": True, "crisis": crisis_flag}


@app.get("/journal/{user_id}")
def journal_list(user_id: str, auth: Optional[str] = Depends(optional_user)):
    check_owner(user_id, auth)
    return {"entries": get_journal(user_id)}


@app.post("/register")
def register(payload: RegisterIn):
    pw = payload.password
    if len(pw) < 8 or not any(c.isupper() for c in pw) or not any(c.isdigit() for c in pw):
        return {"ok": False, "error": "Password must be 8+ chars, include a capital letter and a number."}
    if ACCESS_CODE and (payload.access_code or "").strip() != ACCESS_CODE:
        return {"ok": False, "error": "Invalid access code."}
    if get_user(payload.user_id):
        return {"ok": False, "error": "That Session ID already exists. Try another."}
    create_user(payload.user_id, payload.nickname or "", hash_pw(payload.password))
    if payload.question and payload.answer:
        set_security(payload.user_id, payload.question.strip(), hash_pw(payload.answer.strip().lower()))
    return {"ok": True, "nickname": payload.nickname or "", "token": make_token(payload.user_id)}

@app.post("/login")
def login(payload: LoginIn):
    if is_locked(payload.user_id):
        return LOCKED
    u = get_user(payload.user_id)
    if not u or not check_pw(payload.password, u.get("password_hash", "")):
        record_fail(payload.user_id)
        return {"ok": False, "error": "Invalid Session ID or password."}
    return {"ok": True, "nickname": u.get("nickname", ""), "is_admin": is_admin_user(payload.user_id), "needs_profile": not bool(get_security_question(payload.user_id)) and not is_admin_user(payload.user_id), "token": make_token(payload.user_id)}
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def check_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False
    
@app.post("/change-password")
def change_password(payload: ChangePwIn):
    if is_locked(payload.user_id):
        return LOCKED
    u = get_user(payload.user_id)
    if not u or not check_pw(payload.old_password, u.get("password_hash", "")):
        record_fail(payload.user_id)
        return {"ok": False, "error": "Current password is incorrect."}
    update_password(payload.user_id, hash_pw(payload.new_password))
    return {"ok": True}


@app.post("/clear-data")
def clear_data(payload: UserActionIn):
    if is_locked(payload.user_id):
        return LOCKED
    u = get_user(payload.user_id)
    if not u or not check_pw(payload.password, u.get("password_hash", "")):
        record_fail(payload.user_id)
        return {"ok": False, "error": "Password is incorrect."}
    clear_user_data(payload.user_id)
    return {"ok": True}

@app.post("/delete-account")
def delete_account(payload: UserActionIn):
    if is_locked(payload.user_id):
        return LOCKED
    u = get_user(payload.user_id)
    if not u or not check_pw(payload.password, u.get("password_hash", "")):
        record_fail(payload.user_id)
        return {"ok": False, "error": "Password is incorrect."}
    delete_user_forever(payload.user_id)
    return {"ok": True}

@app.get("/reflection/{user_id}")
def reflection(user_id: str, auth: Optional[str] = Depends(optional_user)):
    check_owner(user_id, auth)
    analyses = get_analyses(user_id)
    if not analyses:
        return {"reflection": "You're here, and that matters. Whenever you're ready to share what's on your mind, I'm listening. 💙"}

    recent = analyses[-8:]
    moods = [a.get("mood", "neutral") for a in recent]
    symptoms = set()
    for a in recent:
        for s in a.get("symptoms", []):
            symptoms.add(s)

    # trajectory: are recent moods lighter than earlier ones?
    half = len(moods) // 2 or 1
    score = {"low": 0, "neutral": 1, "positive": 2}
    early = sum(score.get(m, 1) for m in moods[:half]) / max(half, 1)
    late = sum(score.get(m, 1) for m in moods[half:]) / max(len(moods) - half, 1)
    trend = "improving" if late > early + 0.3 else ("dipping" if late < early - 0.3 else "steady")

    llm = ChatTogether(model=TOGETHER_MODEL, temperature=0.7)
    prompt = (
        "You are a warm, caring companion. Write a SHORT (2-3 sentences) gentle, personal "
        "reflection FOR a student, speaking directly to them ('you'). Be encouraging and human, "
        "like a friend who's been paying attention and cares. \n"
        f"Their recent emotional trend seems to be: {trend}. "
        f"Themes they've touched on: {', '.join(symptoms) if symptoms else 'general life'}.\n"
        "RULES: Never mention scores, symptoms by name, clinical terms, or that you analyzed anything. "
        "Never quote their messages. If they've been struggling, acknowledge their strength for showing up. "
        "If things seem lighter, gently celebrate that with them. Warm, sincere, never fake. "
        "End with quiet reassurance that you're here. Do not use their name."
    )
    try:
        text = llm.invoke(prompt).content.strip()
    except Exception:
        text = "You've been showing up for yourself, and that takes strength. Whatever you're carrying, you're not carrying it alone — I'm here. 💙"
    return {"reflection": text}

@app.post("/practice-event")
def practice_event(payload: PracticeIn, auth: Optional[str] = Depends(optional_user)):
    check_owner(payload.user_id, auth)
    if payload.user_id:
        log_practice(payload.user_id, payload.practice, payload.session_id)
    return {"ok": True}

@app.post("/feedback")
def feedback(payload: FeedbackIn, auth: Optional[str] = Depends(optional_user)):
    check_owner(payload.user_id, auth)
    save_feedback(payload.user_id, payload.rating, payload.comment)
    return {"ok": True}

@app.get("/admin-stats", dependencies=[Depends(require_admin)])
def admin_stats():
    return get_admin_stats()

@app.get("/admin-users", dependencies=[Depends(require_admin)])
def admin_users():
    return {"users": get_all_user_ids()}

@app.get("/admin-assessments", dependencies=[Depends(require_admin)])
def admin_assessments():
    return {"assessments": get_anon_assessments()}

@app.post("/change-nickname")
def change_nickname(payload: NicknameIn, auth: Optional[str] = Depends(optional_user)):
    check_owner(payload.user_id, auth)
    set_nickname(payload.user_id, payload.nickname)
    return {"ok": True}


@app.post("/admin-test-chat", dependencies=[Depends(require_admin)])
def admin_test_chat(payload: ChatIn):
    history = [t.model_dump() for t in payload.history] if payload.history else []
    read = analyze_conversation(history + [{"role": "user", "content": payload.message}])
    crisis_flag = is_crisis(payload.message) or read.get("self_harm_risk", False)
    if crisis_flag:
        hint = ("they may be in crisis or having thoughts of self-harm. Be extremely gentle, "
                "caring, and present. Stay warm, never clinical, never list foreign hotlines, "
                "never abandon them. Keep talking.")
    else:
        hint = "they are testing the system; respond warmly and naturally like the real companion."
    result = answer_with_rag(payload.message, history, support_hint=hint)
    return {
        "reply": result["reply"],
        "mood": read.get("mood", "neutral"),
        "symptoms": read.get("symptoms", []),
        "severity": read.get("severity", {}),
        "needs_support": read.get("needs_support", False),
        "crisis": crisis_flag,
    }

@app.get("/admin-extra", dependencies=[Depends(require_admin)])
def admin_extra():
    return get_admin_extra()

@app.post("/set-security")
def set_security_route(payload: SecuritySetIn, user_id: str = Depends(current_user)):
    if user_id != payload.user_id:
        raise HTTPException(status_code=403, detail="You can only change your own recovery question.")
    set_security(payload.user_id, payload.question.strip(), hash_pw(payload.answer.strip().lower()))
    return {"ok": True}

@app.post("/forgot-question")
def forgot_question(payload: ForgotQIn):
    q = get_security_question(payload.user_id)
    if not q:
        return {"ok": False, "error": "No recovery question set for this ID (or ID not found)."}
    return {"ok": True, "question": q}

@app.post("/forgot-reset")
def forgot_reset(payload: ForgotResetIn):
    if is_locked(payload.user_id):
        return LOCKED
    h = get_security_hash(payload.user_id)
    if not h or not check_pw(payload.answer.strip().lower(), h):
        record_fail(payload.user_id)
        return {"ok": False, "error": "Incorrect answer."}
    pw = payload.new_password
    if len(pw) < 8 or not any(c.isupper() for c in pw) or not any(c.isdigit() for c in pw):
        return {"ok": False, "error": "Password must be 8+ chars, include a capital letter and a number."}
    update_password(payload.user_id, hash_pw(pw))
    return {"ok": True}

@app.post("/verify-answer")
def verify_answer(payload: VerifyAnswerIn):
    if is_locked(payload.user_id):
        return LOCKED
    h = get_security_hash(payload.user_id)
    if not h:
        return {"ok": False, "error": "No recovery question set for this account."}
    if not check_pw(payload.answer.strip().lower(), h):
        record_fail(payload.user_id)
        return {"ok": False, "error": "Incorrect answer."}
    return {"ok": True}

@app.post("/secure-action")
def secure_action(payload: SecureActionIn):
    if is_locked(payload.user_id):
        return LOCKED
    h = get_security_hash(payload.user_id)
    if not h:
        return {"ok": False, "error": "No recovery question set for this account."}
    if not check_pw(payload.answer.strip().lower(), h):
        record_fail(payload.user_id)
        return {"ok": False, "error": "Incorrect answer."}
    if payload.action == "clear":
        clear_user_data(payload.user_id)
    elif payload.action == "delete":
        delete_user_forever(payload.user_id)
    else:
        return {"ok": False, "error": "Unknown action."}
    return {"ok": True}

@app.post("/checkin")
def checkin(payload: CheckInIn, auth: Optional[str] = Depends(optional_user)):
    check_owner(payload.user_id, auth)
    mapped = {"super": "positive", "happy": "positive",
              "meh": "neutral", "stressed": "low"}.get(payload.mood, "neutral")
    save_analysis(payload.user_id, mapped, ["self check-in"],
                  payload.mood == "stressed")
    return {"ok": True}

@app.post("/admin-test-user", dependencies=[Depends(require_admin)])
def admin_test_user(payload: TestUserIn):
    """Create a throwaway user for admin testing, wiping the previous one."""
    if payload.previous_id and payload.previous_id.startswith("TEST-"):
        delete_user_forever(payload.previous_id)

    tag = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    user_id = f"TEST-{tag}"
    password = f"Test{random.randint(1000, 9999)}pass"
    nickname = random.choice(
        ["Ali", "Sara", "Bilal", "Ayesha", "Hamza", "Zainab", "Omar", "Fatima"]
    ) + str(random.randint(10, 99))

    create_user(user_id, nickname, hash_pw(password))
    return {"ok": True, "user_id": user_id, "password": password, "nickname": nickname}

@app.post("/end-session")
def end_session(payload: EndSessionIn, auth: Optional[str] = Depends(optional_user)):
    """Summarise a finished conversation — one LLM call, cached forever."""
    check_owner(payload.user_id, auth)
    from storage import save_session_summary, get_session_summaries
    from rag import summarize_session

    if any(s["session_id"] == payload.session_id for s in get_session_summaries(payload.user_id)):
        return {"ok": True, "cached": True}

    msgs = get_session_messages(payload.user_id, payload.session_id)
    convo = [f"{m['role']}: {m['content']}" for m in msgs
             if m["role"] in ("user", "assistant") and not m["content"].startswith("[")]
    if len(convo) < 2:
        return {"ok": True, "skipped": True}

    summary = summarize_session("\n".join(convo))
    save_session_summary(payload.user_id, payload.session_id, summary)
    return {"ok": True, "summary": summary}


@app.get("/report/{user_id}")
def report(user_id: str, auth: Optional[str] = Depends(optional_user)):
    """Aggregated, patient-owned summary for pre-consultation prep."""
    check_owner(user_id, auth)
    from storage import get_session_summaries
    analyses = get_analyses(user_id)
    summaries = get_session_summaries(user_id)
    all_sessions = list_sessions(user_id)

    # Only COMPLETED sessions count. A session is complete if it was explicitly
    # ended, or if it simply isn't the one currently open. This freezes the
    # report mid-session — it moves only when a conversation is finished.
    ended = {s["session_id"] for s in summaries}
    ids = [s["session_id"] for s in all_sessions]
    current = ids[-1] if ids else None
    # A session only counts if the user actually said something in it.
    with_content = {a.get("session_id") for a in analyses if a.get("session_id")}
    complete = [s for s in all_sessions
                if s["session_id"] in with_content
                and (s["session_id"] in ended or s["session_id"] != current)]
    sessions = complete
    complete_ids = {s["session_id"] for s in complete}
    analyses = [a for a in analyses if a.get("session_id") in complete_ids]

    if not analyses:
        return {"ok": False, "reason": "no data"}

    MIN_SESSIONS = 6
    if not analyses:
        return {"ok": False, "reason": "no data"}
    if len(sessions) < MIN_SESSIONS:
        return {"ok": False, "reason": "not enough sessions",
                "have": len(sessions), "need": MIN_SESSIONS}

    # --- theme frequency: how many distinct sessions each item appeared in ---
    # Merge items that read as the same thing to a non-clinician.
    MERGE = {
        "trouble_relaxing": "relaxing", "hard_to_wind_down": "relaxing",
        "difficult_to_relax": "relaxing",
        "excessive_worry": "worry", "uncontrollable_worry": "worry",
        "nervous_anxious": "worry", "fear_awful": "worry",
        "irritability": "irritability", "touchy": "irritability",
        "intolerant": "irritability",
        "restlessness": "restlessness", "psychomotor_change": "restlessness",
        "agitated": "restlessness", "nervous_energy": "restlessness",
    }
    per_item = {}
    for a in analyses:
        sid = a.get("session_id") or "?"
        for k in (a.get("symptoms") or []):
            per_item.setdefault(MERGE.get(k, k), set()).add(sid)
    total_sessions = max(len(sessions), 1)
    themes = sorted(
        [{"key": k, "sessions": len(v)} for k, v in per_item.items()],
        key=lambda x: -x["sessions"]
    )
    # --- direction of travel: first third vs last third ---
    score = {"low": 2, "neutral": 3, "positive": 4}
    moods = [score.get(a.get("mood", "neutral"), 3) for a in analyses]
    third = max(len(moods) // 3, 1)
    early = sum(moods[:third]) / third
    late = sum(moods[-third:]) / third
    delta = late - early
    direction = ("things have felt somewhat brighter recently" if delta > 0.3
                 else "things have felt heavier recently" if delta < -0.3
                 else "things have stayed fairly steady")

    # --- the student's own words ---
    # Spread quotes across the whole period, not just the most recent messages.
    pool, seen = [], set()
    for a in analyses:
        for s in (a.get("signals") or []):
            s = (s or "").strip()
            if 4 < len(s) < 90 and s.lower() not in seen and s != "self check-in":
                seen.add(s.lower()); pool.append(s)
    if len(pool) <= 6:
        quotes = pool
    else:
        step = len(pool) / 6.0
        quotes = [pool[int(i * step)] for i in range(6)]
    # --- what was never discussed ---
    # Track raw keys separately — merged names would wrongly mark items unobserved.
    observed_raw = set()
    for a in analyses:
        for k in (a.get("symptoms") or []):
            observed_raw.add(k)
    # An item is "not discussed" only if its merge group was never seen either.
    observed_groups = {MERGE.get(k, k) for k in observed_raw}
    never = {
        scale: [i["q"] for i in items
                if i["key"] not in observed_raw
                and MERGE.get(i["key"], i["key"]) not in observed_groups]
        for scale, items in QUESTIONNAIRE.items()
    }

    return {
        "ok": True,
        "generated": datetime.now().isoformat(),
        "session_count": len(sessions),
        "message_count": len(analyses),
        "first": analyses[0].get("ts"),
        "last": analyses[-1].get("ts"),
        "themes": themes[:8],
        "total_sessions": total_sessions,
        "direction": direction,
        "quotes": quotes[:5],
        "never_discussed": never,
        "session_notes": summaries[-8:],
    }