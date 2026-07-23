"""Validated PHQ-8 / GAD-7 / DASS-21(Stress) items mapped to MindEase symptom keys.
PHQ-9 item 9 (self-harm) excluded -> this is PHQ-8, itself a validated instrument.
Each item scored 0-3. This file is the SINGLE SOURCE of item keys."""

QUESTIONNAIRE = {
    "Depression": [  # PHQ-8
        {"key": "loss_of_interest",       "q": "Little interest or pleasure in doing things"},
        {"key": "depressed_mood",         "q": "Feeling down, depressed, or hopeless"},
        {"key": "sleep_problems",         "q": "Trouble falling/staying asleep, or sleeping too much"},
        {"key": "fatigue",                "q": "Feeling tired or having little energy"},
        {"key": "appetite_change",        "q": "Poor appetite or overeating"},
        {"key": "worthlessness_guilt",    "q": "Feeling bad about yourself, or that you're a failure"},
        {"key": "concentration_problems", "q": "Trouble concentrating on things"},
        {"key": "psychomotor_change",     "q": "Moving/speaking slowly, or being restless & fidgety"},
    ],
    "Anxiety": [  # GAD-7 (all 7, real wording)
        {"key": "nervous_anxious",     "q": "Feeling nervous, anxious, or on edge"},
        {"key": "uncontrollable_worry","q": "Not being able to stop or control worrying"},
        {"key": "excessive_worry",     "q": "Worrying too much about different things"},
        {"key": "trouble_relaxing",    "q": "Trouble relaxing"},
        {"key": "restlessness",        "q": "Being so restless that it is hard to sit still"},
        {"key": "irritability",        "q": "Becoming easily annoyed or irritable"},
        {"key": "fear_awful",          "q": "Feeling afraid as if something awful might happen"},
    ],
    "Stress": [  # DASS-21 stress subscale (all 7)
        {"key": "hard_to_wind_down", "q": "Finding it hard to wind down"},
        {"key": "over_reactive",     "q": "Tending to over-react to situations"},
        {"key": "nervous_energy",    "q": "Using a lot of nervous energy"},
        {"key": "agitated",          "q": "Feeling agitated"},
        {"key": "difficult_to_relax","q": "Finding it difficult to relax"},
        {"key": "intolerant",        "q": "Being intolerant of anything keeping you from what you're doing"},
        {"key": "touchy",            "q": "Feeling rather touchy"},
    ],
}

MAX = {"Depression": 24, "Anxiety": 21, "Stress": 21}

# Published cutoffs. Stress is doubled first (DASS-21 convention).
_CUTOFFS = {
    "Depression": [(20, "Severe"), (15, "Moderately Severe"), (10, "Moderate"), (5, "Mild")],
    "Anxiety":    [(15, "Severe"), (10, "Moderate"), (5, "Mild")],
    "Stress":     [(34, "Extremely Severe"), (26, "Severe"), (19, "Moderate"), (15, "Mild")],
}

def scored(scale, raw):
    """DASS-21 subscale scores are multiplied by 2 before banding."""
    return raw * 2 if scale == "Stress" else raw

def band(scale, raw_score):
    s = scored(scale, raw_score)
    for threshold, label in _CUTOFFS.get(scale, []):
        if s >= threshold:
            return label
    return "Minimal"

def build_picture(severity: dict):
    """From the Analyst's severity map, compute per-scale totals, bands, coverage."""
    out = {}
    for scale, items in QUESTIONNAIRE.items():
        answered, missing, total = [], [], 0
        for it in items:
            if it["key"] in severity:
                answered.append(it["key"]); total += int(severity[it["key"]])
            else:
                missing.append(it)
        n, tot = len(answered), len(items)
        # Fewer than half the items answered -> the score is not yet meaningful.
        provisional = n < (tot + 1) // 2
        out[scale] = {
            "score": total, "max": MAX[scale],
            "display_score": scored(scale, total), "display_max": scored(scale, MAX[scale]),
            "band": "Gathering" if provisional else band(scale, total),
            "provisional": provisional,
            "coverage": round(n / tot * 100),
            "answered": answered, "missing": missing,
            "done": len(missing) == 0, "answered_count": n, "total_count": tot,
        }
    return out

def primary_scale(picture: dict):
    return max(picture.items(), key=lambda kv: kv[1]["score"] / kv[1]["max"])[0]

# Convenience lists for other modules — never re-type these keys elsewhere.
KEYS = {s: [i["key"] for i in items] for s, items in QUESTIONNAIRE.items()}
ALL_KEYS = [k for ks in KEYS.values() for k in ks]