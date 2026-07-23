import sqlite3, json
from pathlib import Path

import os
DB_PATH = os.getenv("DB_PATH", "./data/mindease.db")
os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)


def _conn():
    Path("./data").mkdir(parents=True, exist_ok=True)
    return sqlite3.connect(DB_PATH)


def init_db():
    with _conn() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS messages (
            user_id TEXT, session_id TEXT, role TEXT, content TEXT,
            ts DATETIME DEFAULT CURRENT_TIMESTAMP)""")
        c.execute("""CREATE TABLE IF NOT EXISTS analyses (
            user_id TEXT, mood TEXT, signals TEXT, needs_support INTEGER,
            ts DATETIME DEFAULT CURRENT_TIMESTAMP)""")
        c.execute("""CREATE TABLE IF NOT EXISTS journal (
            user_id TEXT, content TEXT, mood TEXT,
            ts DATETIME DEFAULT CURRENT_TIMESTAMP)""")
        c.execute("""CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY, nickname TEXT, password_hash TEXT,
            ts DATETIME DEFAULT CURRENT_TIMESTAMP)""")
        c.execute("""CREATE TABLE IF NOT EXISTS feedback (
            user_id TEXT, rating INTEGER, comment TEXT,
            ts DATETIME DEFAULT CURRENT_TIMESTAMP)""")
        # If upgrading an old DB that has no session_id column, add it.
        cols = [r[1] for r in c.execute("PRAGMA table_info(messages)").fetchall()]
        if "session_id" not in cols:
            c.execute("ALTER TABLE messages ADD COLUMN session_id TEXT")
        if "client_msg_id" not in cols:
            c.execute("ALTER TABLE messages ADD COLUMN client_msg_id TEXT")
        acols = [r[1] for r in c.execute("PRAGMA table_info(analyses)").fetchall()]
        if "symptoms" not in acols:
            c.execute("ALTER TABLE analyses ADD COLUMN symptoms TEXT")
        if "severity" not in acols:
            c.execute("ALTER TABLE analyses ADD COLUMN severity TEXT")  
        if "session_id" not in acols:
            c.execute("ALTER TABLE analyses ADD COLUMN session_id TEXT")
        if "client_msg_id" not in acols:
            c.execute("ALTER TABLE analyses ADD COLUMN client_msg_id TEXT")
        ucols = [r[1] for r in c.execute("PRAGMA table_info(users)").fetchall()]
        if "is_admin" not in ucols:
            c.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0")    
        if "sec_question" not in ucols:
            c.execute("ALTER TABLE users ADD COLUMN sec_question TEXT")
        if "sec_answer_hash" not in ucols:
            c.execute("ALTER TABLE users ADD COLUMN sec_answer_hash TEXT")    




def save_message(user_id, role, content, session_id=None, client_msg_id=None):
    with _conn() as c:
        c.execute(
            "INSERT INTO messages (user_id, session_id, role, content, client_msg_id) VALUES (?,?,?,?,?)",
            (user_id, session_id, role, content, client_msg_id))


def get_messages(user_id, limit=20):
    with _conn() as c:
        rows = c.execute(
            "SELECT role, content FROM messages WHERE user_id=? ORDER BY ts DESC LIMIT ?",
            (user_id, limit)).fetchall()
    return [{"role": r, "content": ct} for r, ct in reversed(rows)]


def list_sessions(user_id):
    """Return each past session for a user: its id, start time, and message count."""
    with _conn() as c:
        rows = c.execute(
            """SELECT session_id, MIN(ts) AS started, COUNT(*) AS n
               FROM messages
               WHERE user_id=? AND session_id IS NOT NULL
               GROUP BY session_id
               ORDER BY started DESC""",
            (user_id,)).fetchall()
    return [{"session_id": s, "started": started, "count": n} for s, started, n in rows]


def get_session_messages(user_id, session_id):
    """Return all messages for one specific session."""
    with _conn() as c:
        rows = c.execute(
            "SELECT role, content FROM messages WHERE user_id=? AND session_id=? ORDER BY ts",
            (user_id, session_id)).fetchall()
    return [{"role": r, "content": ct} for r, ct in rows]


def delete_cancelled_message(user_id, session_id, client_msg_id):
    """Remove the user message with this client_msg_id, its reply (if the
    pipeline already saved one — tagged with the same id), and its analysis.
    Precise: cannot touch any other message, no matter the timing."""
    if not client_msg_id:
        return
    with _conn() as c:
        c.execute(
            "DELETE FROM messages WHERE user_id=? AND session_id=? AND client_msg_id=?",
            (user_id, session_id, client_msg_id))
        c.execute(
            "DELETE FROM analyses WHERE user_id=? AND client_msg_id=?",
            (user_id, client_msg_id))


def save_analysis(user_id, mood, signals, needs_support, symptoms=None, severity=None, session_id=None, client_msg_id=None):
    with _conn() as c:
        c.execute("INSERT INTO analyses (user_id, session_id, mood, signals, needs_support, symptoms, severity, client_msg_id) VALUES (?,?,?,?,?,?,?,?)",
                  (user_id, session_id, mood, json.dumps(signals), 1 if needs_support else 0,
                   json.dumps(symptoms or []), json.dumps(severity or {}), client_msg_id))


def get_analyses(user_id):
    with _conn() as c:
        rows = c.execute(
            "SELECT mood, signals, needs_support, ts, symptoms, severity, session_id FROM analyses WHERE user_id=? ORDER BY ts",
            (user_id,)).fetchall()
    out = []
    for m, s, n, t, sym, sev, sid in rows:
        out.append({"mood": m, "signals": json.loads(s), "needs_support": bool(n), "ts": t,
                    "symptoms": json.loads(sym) if sym else [],
                    "severity": json.loads(sev) if sev else {},
                    "session_id": sid})
    return out

def save_journal(user_id, content, mood=""):
    with _conn() as c:
        c.execute("INSERT INTO journal (user_id, content, mood) VALUES (?,?,?)",
                  (user_id, content, mood))


def get_journal(user_id):
    with _conn() as c:
        rows = c.execute(
            "SELECT content, mood, ts FROM journal WHERE user_id=? ORDER BY ts DESC",
            (user_id,)).fetchall()
    return [{"content": ct, "mood": m, "ts": t} for ct, m, t in rows]

def create_user(user_id, nickname="", password_hash=""):
    with _conn() as c:
        c.execute("INSERT OR IGNORE INTO users (user_id, nickname, password_hash) VALUES (?,?,?)",
                  (user_id, nickname, password_hash))


def get_user(user_id):
    with _conn() as c:
        row = c.execute("SELECT user_id, nickname, password_hash FROM users WHERE user_id=?",
                        (user_id,)).fetchone()
    if not row:
        return None
    return {"user_id": row[0], "nickname": row[1], "password_hash": row[2]}


def set_nickname(user_id, nickname):
    with _conn() as c:
        c.execute("UPDATE users SET nickname=? WHERE user_id=?", (nickname, user_id))

def update_password(user_id, password_hash):
    with _conn() as c:
        c.execute("UPDATE users SET password_hash=? WHERE user_id=?", (password_hash, user_id))

def clear_user_data(user_id):
    with _conn() as c:
        c.execute("DELETE FROM messages WHERE user_id=?", (user_id,))
        c.execute("DELETE FROM analyses WHERE user_id=?", (user_id,))
        c.execute("DELETE FROM journal WHERE user_id=?", (user_id,))
        c.commit()


def delete_user_forever(user_id):
    """Nuke everything — account included."""
    with _conn() as c:
        c.execute("DELETE FROM messages WHERE user_id=?", (user_id,))
        c.execute("DELETE FROM analyses WHERE user_id=?", (user_id,))
        c.execute("DELETE FROM journal WHERE user_id=?", (user_id,))
        c.execute("DELETE FROM users WHERE user_id=?", (user_id,))
        c.commit()

def log_practice(user_id, practice_name, session_id=None):
    with _conn() as c:
        c.execute(
            "INSERT INTO messages (user_id, session_id, role, content) VALUES (?,?,?,?)",
            (user_id, session_id, "system", f"[User just completed a wellbeing practice: {practice_name}]"))

def save_feedback(user_id, rating, comment=""):
    with _conn() as c:
        c.execute("INSERT INTO feedback (user_id, rating, comment) VALUES (?,?,?)",
                  (user_id, rating, comment))     

def get_admin_stats():
    with _conn() as c:
        users = c.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        msgs = c.execute("SELECT COUNT(*) FROM messages WHERE role='user'").fetchone()[0]
        sessions = c.execute("SELECT COUNT(DISTINCT session_id) FROM messages WHERE session_id IS NOT NULL").fetchone()[0]
        analyses = c.execute("SELECT COUNT(*) FROM analyses").fetchone()[0]
        journals = c.execute("SELECT COUNT(*) FROM journal").fetchone()[0]
        fb = c.execute("SELECT rating, comment, ts FROM feedback ORDER BY ts DESC LIMIT 20").fetchall()
        avg_rating = c.execute("SELECT AVG(rating) FROM feedback").fetchone()[0]
    return {"users": users, "messages": msgs, "sessions": sessions,
            "analyses": analyses, "journals": journals,
            "avg_rating": round(avg_rating, 1) if avg_rating else 0,
            "feedback": [{"rating": r, "comment": c2, "ts": t} for r, c2, t in fb]}   

def get_all_user_ids():
    with _conn() as c:
        rows = c.execute("SELECT user_id FROM users ORDER BY ts").fetchall()
    return [r[0] for r in rows]

def get_anon_assessments():
    import json
    with _conn() as c:
       from questionnaire import KEYS
    DEP, ANX, STR = KEYS["Depression"], KEYS["Anxiety"], KEYS["Stress"]
    out = []
    for i, uid in enumerate(uids, 1):
        with _conn() as c:
            rows = c.execute("SELECT severity FROM analyses WHERE user_id=?", (uid,)).fetchall()
        maxsev = {}
        for (sev,) in rows:
            if not sev: continue
            for k, v in json.loads(sev).items():
                maxsev[k] = max(maxsev.get(k, 0), int(v))
        if not maxsev: continue  # skip users with no real assessment data
        def band(v, mx): 
            pct = v / mx if mx else 0
            return "Severe" if pct >= 0.62 else "Moderate" if pct >= 0.42 else "Mild" if pct >= 0.2 else "Minimal"
        out.append({
            "label": f"User {i}",
            "depression": sum(maxsev.get(k, 0) for k in DEP),
            "anxiety": sum(maxsev.get(k, 0) for k in ANX),
            "stress": sum(maxsev.get(k, 0) for k in STR),
            "symptoms": len(maxsev),
            "dep_band": band(sum(maxsev.get(k, 0) for k in DEP), 24),
            "anx_band": band(sum(maxsev.get(k, 0) for k in ANX), 18),
            "str_band": band(sum(maxsev.get(k, 0) for k in STR), 18),
        })
    return out

def change_user_id(old_id, new_id):
    with _conn() as c:
        if not c.execute("SELECT 1 FROM users WHERE user_id=?", (old_id,)).fetchone():
            return False  # old id doesn't exist
        if c.execute("SELECT 1 FROM users WHERE user_id=?", (new_id,)).fetchone():
            return False  # new id taken
        for t in ["messages", "analyses", "journal", "feedback", "users"]:
            c.execute(f"UPDATE {t} SET user_id=? WHERE user_id=?", (new_id, old_id))
    return True

def is_admin_user(user_id):
    with _conn() as c:
        r = c.execute("SELECT is_admin FROM users WHERE user_id=?", (user_id,)).fetchone()
    return bool(r and r[0])

def get_admin_stats():
    from questionnaire import KEYS
    DEP, ANX, STR = KEYS["Depression"], KEYS["Anxiety"], KEYS["Stress"]
    with _conn() as c:
        users = c.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        msgs = c.execute("SELECT COUNT(*) FROM messages WHERE role='user'").fetchone()[0]
        sessions = c.execute("SELECT COUNT(DISTINCT session_id) FROM messages WHERE session_id IS NOT NULL").fetchone()[0]
        analyses = c.execute("SELECT COUNT(*) FROM analyses").fetchone()[0]
        journals = c.execute("SELECT COUNT(*) FROM journal").fetchone()[0]
        fb = c.execute("SELECT rating, comment, ts FROM feedback ORDER BY ts DESC LIMIT 20").fetchall()
        avg_rating = c.execute("SELECT AVG(rating) FROM feedback").fetchone()[0]
        prows = c.execute("SELECT content, COUNT(*) FROM messages WHERE role='system' AND content LIKE '[User just completed a wellbeing practice:%' GROUP BY content").fetchall()
        active7 = c.execute("SELECT COUNT(DISTINCT user_id) FROM messages WHERE ts >= datetime('now','-7 days')").fetchone()[0]
        returning = c.execute("SELECT COUNT(*) FROM (SELECT user_id FROM messages WHERE session_id IS NOT NULL GROUP BY user_id HAVING COUNT(DISTINCT session_id)>1)").fetchone()[0]
        hrow = c.execute("SELECT strftime('%H', ts) h FROM messages WHERE role='user' GROUP BY h ORDER BY COUNT(*) DESC LIMIT 1").fetchone()
        arows = c.execute("SELECT user_id, mood, symptoms, severity FROM analyses").fetchall()
    practices = sorted([{"name": ct.split(":",1)[1].replace("]","").strip(), "count": n} for ct, n in prows], key=lambda x: -x["count"])
    moods, sym_counts, user_sev = {}, {}, {}
    for uid, mood, sym, sev in arows:
        if mood: moods[mood] = moods.get(mood, 0) + 1
        if sym:
            for x in json.loads(sym): sym_counts[x] = sym_counts.get(x, 0) + 1
        if sev:
            d = user_sev.setdefault(uid, {})
            for k, v in json.loads(sev).items(): d[k] = max(d.get(k, 0), int(v))
    nu = len(user_sev) or 1
    avg = lambda keys: round(sum(sum(d.get(k, 0) for k in keys) for d in user_sev.values()) / nu, 1)
    return {"users": users, "messages": msgs, "sessions": sessions, "analyses": analyses,
            "journals": journals, "avg_rating": round(avg_rating, 1) if avg_rating else 0,
            "feedback": [{"rating": r, "comment": c2, "ts": t} for r, c2, t in fb],
            "practices": practices,
            "top_symptoms": sorted([{"name": k.replace("_", " "), "count": v} for k, v in sym_counts.items()], key=lambda x: -x["count"])[:6],
            "avg_severity": {"dep": avg(DEP), "anx": avg(ANX), "str": avg(STR)},
            "mood_dist": sorted([{"mood": k, "count": v} for k, v in moods.items()], key=lambda x: -x["count"]),
            "active7": active7, "returning": returning,
            "peak_hour": f"{int(hrow[0])}:00" if hrow else "—"}
    
def get_admin_extra():
    with _conn() as c:
        crises = c.execute("SELECT COUNT(*) FROM analyses WHERE signals LIKE '%crisis_flag%'").fetchone()[0]
        prows = c.execute("SELECT user_id, MIN(ts) FROM messages WHERE role='system' AND content LIKE '%completed a wellbeing practice%' GROUP BY user_id").fetchall()
        prac = {u: t for u, t in prows if u and t}
        rows = c.execute("SELECT user_id, ts, needs_support FROM analyses").fetchall()
    # per user: count distress readings before vs after their first practice
    stats = {}  # uid -> [b_n, b_ns, a_n, a_ns]
    for uid, ts, ns in rows:
        if uid not in prac or not ts:
            continue
        d = stats.setdefault(uid, [0, 0, 0, 0])
        if ts >= prac[uid]:
            d[2] += 1; d[3] += 1 if ns else 0
        else:
            d[0] += 1; d[1] += 1 if ns else 0
    before_rates, after_rates, improved, qualified = [], [], 0, 0
    for b_n, b_ns, a_n, a_ns in stats.values():
        if b_n == 0 or a_n == 0:
            continue  # need both sides to compare this user fairly
        qualified += 1
        br, ar = b_ns / b_n, a_ns / a_n
        before_rates.append(br); after_rates.append(ar)
        if ar < br: improved += 1
    avg = lambda xs: round(100 * sum(xs) / len(xs)) if xs else 0
    return {"crises": int(crises or 0),
            "impact": {"before": avg(before_rates), "after": avg(after_rates),
                       "users": qualified, "improved": improved}}

def set_security(user_id, question, answer_hash):
    with _conn() as c:
        c.execute("UPDATE users SET sec_question=?, sec_answer_hash=? WHERE user_id=?", (question, answer_hash, user_id))

def get_security_question(user_id):
    with _conn() as c:
        r = c.execute("SELECT sec_question FROM users WHERE user_id=?", (user_id,)).fetchone()
    return r[0] if r and r[0] else None

def get_security_hash(user_id):
    with _conn() as c:
        r = c.execute("SELECT sec_answer_hash FROM users WHERE user_id=?", (user_id,)).fetchone()
    return r[0] if r and r[0] else None

def init_summaries():
    with _conn() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS session_summaries (
            user_id TEXT, session_id TEXT, summary TEXT,
            ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, session_id))""")

def save_session_summary(user_id, session_id, summary):
    with _conn() as c:
        c.execute("INSERT OR REPLACE INTO session_summaries (user_id, session_id, summary) VALUES (?,?,?)",
                  (user_id, session_id, summary))

def get_session_summaries(user_id):
    with _conn() as c:
        rows = c.execute("SELECT session_id, summary, ts FROM session_summaries WHERE user_id=? ORDER BY ts",
                         (user_id,)).fetchall()
    return [{"session_id": r[0], "summary": r[1], "ts": r[2]} for r in rows]