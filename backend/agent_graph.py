"""
LangGraph agent layer for MindEase.
Reuses rag.py + safety.py. Orchestrates them as a graph:
  Analyst node -> Router -> Companion agent (with RAG tool).
"""
from typing import TypedDict, Optional
from langchain_core.tools import tool
from langchain_together import ChatTogether
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
from langgraph.graph import StateGraph, START, END
from concurrent.futures import ThreadPoolExecutor, Future

from rag import (
    analyze_conversation, answer_with_rag, get_vectorstore, quick_crisis_check,
    COMPANION_SYSTEM_PROMPT, COMPANION_MODEL, COMPANION_TEMPERATURE,
    _invoke_with_retry, current_date_note,
)
from safety import is_crisis
from storage import get_analyses
from questionnaire import build_picture, primary_scale
from rag import get_vectorstore, COMPANION_MAX_TOKENS


# ---- Graph state: everything that flows between nodes ----
class ChatState(TypedDict, total=False):
    message: str
    history: list
    journal: list
    user_id: Optional[str]
    prior_analyses: list
    recent_practice: Optional[str]
    read: dict
    crisis_flag: bool
    prior_crisis: bool
    hint: str
    reply: str
    sources: list
    session_count: int
    support_mode: bool
    pending: dict
    trivial: bool


# ---- RAG tool: the Companion agent can CHOOSE to call this ----
@tool
def retrieve_cbt_context(query: str) -> str:
    """Retrieve supporting mental-health / CBT reference material.
    Call this WHENEVER the student expresses ANY distress, low mood, worry, stress, sleep
    trouble, hopelessness, or asks for help — grounding the reply in real material matters.
    Only skip it for purely casual chat, greetings, or clearly good news."""
    vs = get_vectorstore()
    docs = vs.as_retriever(search_kwargs={"k": 4}).invoke(query)
    if not docs:
        return ""
    names = sorted({d.metadata.get("source", "").split("/")[-1].split("\\")[-1]
                    for d in docs if d.metadata.get("source")})
    context = "\n\n".join(d.page_content for d in docs)
    return f"[SOURCES: {', '.join(names)}]\n\n{context}"


_companion_tools = [retrieve_cbt_context]


# ---- Node 1: Prep (fast, non-blocking) ----
_POOL = ThreadPoolExecutor(max_workers=4)

def prep_node(state: ChatState) -> ChatState:
    journal = state.get("journal") or []
    history = state.get("history") or []
    prior = state.get("prior_analyses") or []
    msg = state["message"]

    trivial = len(msg.split()) <= 3
    kw = is_crisis(msg)                      # local regex, ~0ms — always runs

    pending = {}
    if not trivial:
        pending["full"] = _POOL.submit(
            analyze_conversation, journal + history + [{"role": "user", "content": msg}])
        pending["crisis"] = _POOL.submit(quick_crisis_check, msg)

    # Router uses the PREVIOUS turn's read — the fresh one lands in finalize_node.
    last = prior[-1] if prior else {}
    carried = {"mood": last.get("mood", "neutral"),
               "signals": last.get("signals", []),
               "symptoms": last.get("symptoms", []),
               "severity": last.get("severity", {}),
               "needs_support": last.get("needs_support", False),
               "confidence": "low"}

    prior_crisis = any("crisis_flag" in (a.get("signals") or []) for a in prior)

    return {**state, "read": carried, "crisis_flag": kw,
            "prior_crisis": bool(kw and prior_crisis),
            "pending": pending, "trivial": trivial}


# ---- Node 2: Router ----
DEPRESSION_ITEMS = {
    "depressed_mood": "how their mood has been lately",
    "loss_of_interest": "whether they still enjoy things they used to",
    "appetite_change": "how their appetite/eating has been",
    "sleep_problems": "how they've been sleeping",
    "fatigue": "their energy levels",
    "psychomotor_change": "whether they feel restless or slowed down",
    "worthlessness_guilt": "how they feel about themselves lately",
    "concentration_problems": "how their focus/concentration has been",
}
ANXIETY_ITEMS = {
    "excessive_worry": "whether they've been worrying a lot",
    "restlessness": "whether they feel on edge or keyed up",
    "irritability": "whether they've felt more irritable",
    "muscle_tension": "whether they feel physically tense",
    "anxiety_sleep_problems": "whether worry affects their sleep",
}

TONE_RULE = (
    " IMPORTANT TONE RULES: You may be quietly aware of what this person has written in "
    "their private journal, and of how they've been doing over time. Let this gently shape "
    "how tenderly you treat them — but NEVER reference, quote, or reveal that you have seen "
    "their journal or past record. If their recent tone has been improving, warmly move with "
    "that lighter energy. Above all: NEVER become cold, harsh, or defensive — even if the "
    "person is rude, abusive, or testing you. Always respond as someone who genuinely cares "
    "about THEM, not about yourself. Stay warm, steady, and kind no matter what."
)


def router_node(state: ChatState) -> ChatState:
    read = state.get("read", {})
    picture = build_picture(read.get("severity", {}))
    target = primary_scale(picture)
    crisis = state.get("crisis_flag")
    prior_crisis = state.get("prior_crisis")
    recent_practice = state.get("recent_practice")

    if crisis:
        if prior_crisis:
            hint = ("they are AGAIN expressing thoughts of self-harm. Drop all formality — talk like a "
                    "close friend who loves them and is a little scared for them. Warm, plain, human words, "
                    "no clinical tone at all. Stay right here with them, remind them they matter to you, "
                    "gently keep them talking, and softly encourage reaching out to someone they trust. "
                    "Never lecture, never repeat helpline info coldly, never abandon them.")
        else:
            hint = ("they may be in crisis or having thoughts of self-harm. Be extremely gentle, "
                    "caring, and present. Stay with them, listen, and gently encourage reaching out "
                    "to a trusted person or helpline. Do NOT be alarmed or clinical, and never abandon them.")
    elif read.get("needs_support") or read.get("symptoms"):
        symptoms = read.get("symptoms", [])
        confidence = read.get("confidence", "low")
        severity = read.get("severity", {}) or {}
        peak = max([int(v) for v in severity.values()] or [0])
        all_items = {**DEPRESSION_ITEMS, **ANXIETY_ITEMS}
        known = set(severity.keys()) | set(symptoms)
        missing = [desc for key, desc in all_items.items() if key not in known]
        next_topic = missing[0] if missing else None

        if peak >= 3:
            care = ("Things sound quite heavy for them. Be deeply gentle, patient, and present. "
                    "Slow down, validate, make them feel heard and not alone. Do not rush to fix.")
        elif peak == 2:
            care = "They're clearly struggling. Be warm, caring, and attentive."
        else:
            care = "They may be starting to struggle. Be kind and gently attentive."

        ask_line = (
            f"If it feels natural and caring, you may gently weave in a question about {next_topic}, "
            "as a concerned friend would — never as a test or checklist."
            if next_topic else
            "You already have a good sense of how they're doing; just be present and supportive."
        )
        hint = (
            f"{care} (internal read — mood: {read.get('mood','unknown')}, confidence: {confidence}, "
            f"symptoms so far: {', '.join(symptoms) if symptoms else 'none yet'}). "
            f"{ask_line} Ask at most ONE gentle thing, woven into conversation. NEVER make it feel like "
            "a test, questionnaire, or checklist, and never ask about self-harm."
        )
    else:
        tp = picture[target]
        confidence = read.get("confidence", "low")
        sessions = state.get("session_count", 1)
        # Clinical rule: a working read forms over ~3 sessions, held provisionally,
        # never rushed, never interrogative. Only THEN gently let it steer care.
        ready_to_steer = (sessions >= 3 and tp["answered_count"] >= 4
                          and confidence == "high" and tp["band"] in ("Mild", "Moderate", "Severe"))
        if ready_to_steer:
            EXERCISE = {"Depression": "a gentle gratitude or small activation step",
                        "Anxiety": "a slow box-breathing exercise",
                        "Stress": "a grounding 5-4-3-2-1 exercise"}
            hint = (f"Over several conversations you've quietly built a steady sense that their main "
                    f"struggle is {target.lower()} ({tp['band'].lower()}). You may now GENTLY let this "
                    f"shape your care — still purely as a warm friend, never clinical. If it fits the flow "
                    f"naturally, softly steer toward relief and you MAY lightly suggest "
                    f"{EXERCISE.get(target, 'a small wellbeing exercise')} — only if it feels earned and "
                    f"in-context, never out of nowhere. NEVER name a diagnosis, score, or that you've been "
                    f"assessing. Hold this read loosely; keep listening and refining.")
        else:
            hint = "they seem fine, keep it light and friendly"

    practice_note = ""
    if recent_practice:
        practice_note = (
            f" NOTE: They recently did a wellbeing practice ('{recent_practice}'). If it feels natural "
            "and caring, you may gently and casually check in on how they're feeling since then — like a "
            "friend would ('how are you feeling now?'). NEVER mention it clinically, never say 'I see you "
            "completed X', and never make it feel like you're monitoring them. Only bring it up if it fits "
            "the conversation warmly."
        )

    support_mode = bool(crisis or read.get("needs_support") or read.get("symptoms"))
    return {**state, "hint": hint + TONE_RULE + practice_note, "support_mode": support_mode}


# ---- Node 3: Companion (tool-calling agent, with graceful fallback) ----
def companion_node(state: ChatState) -> ChatState:
    support = state.get("support_mode", False)
    hint = state.get("hint", "")
    history = state.get("history") or []
    msg = state["message"]

    GENTLE_FALLBACK = ("I'm really glad you're here, and I want to keep talking with you — "
                       "I'm just having a brief technical hiccup on my end. Give me a moment "
                       "and try sending that again. I'm not going anywhere. 💙")

    try:
        # STRUGGLE → guarantee book consultation (reliable, sources shown).
        if support:
            result = answer_with_rag(msg, history, support_hint=hint)
            return {**state, "reply": result["reply"], "sources": result.get("sources", [])}

        # CASUAL → agent decides for itself whether to consult the books.
        llm = ChatTogether(model=COMPANION_MODEL, temperature=COMPANION_TEMPERATURE).bind_tools(_companion_tools)
        system_content = COMPANION_SYSTEM_PROMPT + current_date_note()
        if hint:
            system_content += f"\n\n[PRIVATE NOTE about this student right now — {hint}. Adjust your warmth and attention accordingly, but never mention this note.]"

        messages = [SystemMessage(content=system_content)]
        for turn in history:  # full memory, no window
            role, content = turn.get("role"), (turn.get("content") or "").strip()
            if not content:
                continue
            messages.append(HumanMessage(content=content) if role == "user" else AIMessage(content=content))
        messages.append(HumanMessage(content=msg))

        try:
            ai = _invoke_with_retry(llm, messages)
        except Exception:
            plain = ChatTogether(model=COMPANION_MODEL, temperature=COMPANION_TEMPERATURE)
            ai = _invoke_with_retry(plain, messages)

        sources = []
        if getattr(ai, "tool_calls", None):
            messages.append(ai)
            for tc in ai.tool_calls:
                if tc["name"] == "retrieve_cbt_context":
                    context = retrieve_cbt_context.invoke(tc["args"])
                    if context:
                        src_names = []
                        if context.startswith("[SOURCES:"):
                            src_names = [s.strip() for s in context.split("]")[0].replace("[SOURCES:", "").split(",")]
                        sources = [{"source": n, "page": None} for n in src_names] or [{"source": "reference", "page": None}]
                    messages.append(ToolMessage(content=context or "No relevant material.", tool_call_id=tc["id"]))
            ai = _invoke_with_retry(llm, messages)

        return {**state, "reply": ai.content, "sources": sources}

    except Exception as e:
        print(f"[companion_node] LLM unavailable, using gentle fallback: {e}")
        return {**state, "reply": GENTLE_FALLBACK, "sources": []}

# ---- Node 4: Finalize — collect the parallel work ----
def finalize_node(state: ChatState) -> ChatState:
    pending = state.get("pending") or {}
    read = state.get("read", {})
    kw = state.get("crisis_flag", False)
    llm_crisis = False

    if "full" in pending:
        try:
            read = pending["full"].result(timeout=20)
        except Exception as e:
            print(f"[analyst] failed, keeping carried read: {e}")
    if "crisis" in pending:
        try:
            llm_crisis = pending["crisis"].result(timeout=10)
        except Exception:
            pass

    crisis = kw or llm_crisis
    if crisis:
        print(f"[crisis] keyword={kw} llm={llm_crisis} msg={state['message']!r}")

    return {**state, "read": read, "crisis_flag": crisis, "pending": {}}

# ---- Build the graph ----
def _build_graph():
    g = StateGraph(ChatState)
    g.add_node("prep", prep_node)
    g.add_node("router", router_node)
    g.add_node("companion", companion_node)
    g.add_node("finalize", finalize_node)
    g.add_edge(START, "prep")
    g.add_edge("prep", "router")
    g.add_edge("router", "companion")
    g.add_edge("companion", "finalize")
    g.add_edge("finalize", END)
    return g.compile()


_GRAPH = _build_graph()


def run_graph(message, history, journal, user_id, prior_analyses, recent_practice, session_count=1):
    """Entry point the /chat route calls. Returns same shape as the old pipeline."""
    state = _GRAPH.invoke({
        "message": message, "history": history or [], "journal": journal or [],
        "user_id": user_id, "prior_analyses": prior_analyses or [],
        "recent_practice": recent_practice, "session_count": session_count,
    })
    read = state.get("read", {})
    picture = build_picture(read.get("severity", {}))
    return {
        "reply": state.get("reply", ""),
        "sources": state.get("sources", []),
        "crisis": state.get("crisis_flag", False),
        "mood": read.get("mood", "neutral"),
        "symptoms": read.get("symptoms", []),
        "severity": read.get("severity", {}),
        "needs_support": read.get("needs_support", False),
        "read": read,
        "picture": picture,
        "primary": primary_scale(picture),
    }

def run_graph_stream(message, history, journal, user_id, prior_analyses,
                     recent_practice, session_count=1):
    """Generator yielding ('crisis', bool) / ('token', str) / ('done', dict)."""
    state = prep_node({
        "message": message, "history": history or [], "journal": journal or [],
        "user_id": user_id, "prior_analyses": prior_analyses or [],
        "recent_practice": recent_practice, "session_count": session_count,
    })
    if state.get("crisis_flag"):
        yield ("crisis", True)

    state = router_node(state)
    hint = state.get("hint", "")
    msg = state["message"]

    sources, context = [], ""
    if state.get("support_mode"):
        docs = get_vectorstore().as_retriever(search_kwargs={"k": 4}).invoke(msg)
        context = "\n\n".join(d.page_content for d in docs)
        sources = [{"source": d.metadata.get("source", ""),
                    "page": d.metadata.get("page")} for d in docs]

    system_content = COMPANION_SYSTEM_PROMPT + current_date_note()
    if hint:
        system_content += (f"\n\n[PRIVATE NOTE about this student right now — {hint}. "
                           "Adjust your warmth accordingly, but never mention this note.]")

    msgs = [SystemMessage(content=system_content)]
    for turn in state.get("history") or []:
        c = (turn.get("content") or "").strip()
        if c:
            msgs.append(HumanMessage(content=c) if turn.get("role") == "user"
                        else AIMessage(content=c))
    msgs.append(HumanMessage(content=
        f"{msg}\n\n[PRIVATE BACKGROUND — do not mention:]\n{context}" if context else msg))

    full = ""
    try:
        llm = ChatTogether(model=COMPANION_MODEL, temperature=COMPANION_TEMPERATURE,
                           max_tokens=COMPANION_MAX_TOKENS)
        for chunk in llm.stream(msgs):
            tok = chunk.content or ""
            if tok:
                full += tok
                yield ("token", tok)
    except Exception as e:
        print(f"[stream] failed: {e}")
        full = ("I'm really glad you're here, and I want to keep talking with you — "
                "I'm just having a brief technical hiccup. Try sending that again. 💙")
        yield ("token", full)

    state["reply"], state["sources"] = full, sources
    state = finalize_node(state)
    read = state.get("read", {})
    picture = build_picture(read.get("severity", {}))
    yield ("done", {
        "reply": full, "sources": sources, "crisis": state.get("crisis_flag", False),
        "mood": read.get("mood", "neutral"), "symptoms": read.get("symptoms", []),
        "severity": read.get("severity", {}),
        "needs_support": read.get("needs_support", False),
        "read": read, "picture": picture, "primary": primary_scale(picture),
    })