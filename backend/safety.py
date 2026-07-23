import re


def is_crisis(text: str) -> bool:
    t = text.lower()
    # normalize so hyphens/apostrophes/punctuation don't cause misses
    t = t.replace("-", " ").replace("'", "").replace("’", "")
    t_nospace = t.replace(" ", "")
    crisis_phrases = [
        # direct
        "suicide", "suicidal", "kill myself", "killing myself",
        "end my life", "end it all", "take my own life",
        "self harm", "harm myself", "hurt myself", "hurting myself", "cut myself",
        # wanting to die
        "want to die", "wanna die", "want to be dead", "wish i was dead",
        "wish i were dead", "wish i wasnt here", "wish i didnt exist",
        # not wanting to live / be here
        "dont want to live", "dont want to be alive", "dont want to be here",
        "dont want to be in this world", "dont want to live in this world",
        "cant live like this", "cant keep living", "cant go on", "cant do this anymore",
        "tired of living", "tired of being alive", "done with life",
        # hopeless / no point
        "no point in living", "no reason to live", "nothing to live for",
        "whats the point of anything", "whats the point of living",
        "no point anymore", "give up on life",
        # burden
        "better off without me", "better off dead", "everyone would be better off without me",
        "world would be better without me",
        # ending it
        "end myself", "want it to end", "want it all to end", "make it stop forever",
    ]
    if any(p in t or p.replace(" ", "") in t_nospace for p in crisis_phrases):
        return True
    # "end it" / "kill me" need word boundaries — plain substring matching
    # fires on "send it", "spend it", "this exam will kill me", etc.
    if re.search(r"\bend it\b", t) and not re.search(r"\b(send|spend|attend|extend)", t):
        return True
    if re.search(r"\bkill me\b", t) and not re.search(r"\b(will|gonna|going to|would|could|might)\s+kill me\b", t):
        return True
    return False


def crisis_message() -> str:
    return (
        "I'm really sorry you're feeling this way. You're not alone.\n\n"
        "If you're in immediate danger, call your local emergency number right now.\n"
        "If you can, reach out to someone you trust and stay with them.\n\n"
        "If you're safe for the moment: are you alone right now, and what's happening?"
    )