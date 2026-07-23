const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8001";

/**
 * Send a chat message to the MindEase backend.
 */
export async function sendMessage(message, history = [], sessionId = null, visitSession = null, signal = undefined, msgId = null) {
  try {
    const res = await fetch(`${BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history, user_id: sessionId, session_id: visitSession, msg_id: msgId }),
      signal,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Chat API error ${res.status}: ${err}`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    return { reply: "Could not reach server.", crisis: false, sources: [] };
  }
}

export async function streamMessage(message, history, sessionId, visitSession,
                                    signal, msgId, onEvent) {
  const res = await fetch(`${BASE_URL}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, user_id: sessionId,
                           session_id: visitSession, msg_id: msgId }),
    signal,
  });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop();
    for (const p of parts) {
      if (!p.startsWith("data: ")) continue;
      try { onEvent(JSON.parse(p.slice(6))); } catch {}
    }
  }
}

export async function ingestBooks() {
  const res = await fetch(`${BASE_URL}/ingest`, { method: "POST" });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ingest API error ${res.status}: ${err}`);
  }
  return res.json();
}

export async function checkHealth() {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function getHistory(sessionId) {
  try {
    const res = await fetch(`${BASE_URL}/history/${sessionId}`);
    if (!res.ok) return { messages: [] };
    return res.json();
  } catch {
    return { messages: [] };
  }
}

export async function getAnalytics(sessionId) {
  try {
    const res = await fetch(`${BASE_URL}/analytics/${sessionId}`);
    if (!res.ok) return { analyses: [] };
    return res.json();
  } catch {
    return { analyses: [] };
  }
}

export async function getSessions(sessionId) {
  try {
    const res = await fetch(`${BASE_URL}/sessions/${sessionId}`);
    if (!res.ok) return { sessions: [] };
    return res.json();
  } catch {
    return { sessions: [] };
  }
}

export async function getSessionMessages(userId, sessId) {
  try {
    const res = await fetch(`${BASE_URL}/session/${userId}/${sessId}`);
    if (!res.ok) return { messages: [] };
    return res.json();
  } catch {
    return { messages: [] };
  }
}

export async function logCrisisEvent(sessionId, visitSession) {
  try {
    await fetch(`${BASE_URL}/crisis-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "", user_id: sessionId, session_id: visitSession }),
    });
  } catch {}
}

// ---- Journal ----
export async function saveJournal(sessionId, content, mood = "") {
  try {
    const res = await fetch(`${BASE_URL}/journal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: sessionId, content, mood }),
    });
    if (!res.ok) return { ok: false };
    return res.json();
  } catch {
    return { ok: false };
  }
}

export async function getJournal(sessionId) {
  try {
    const res = await fetch(`${BASE_URL}/journal/${sessionId}`);
    if (!res.ok) return { entries: [] };
    return res.json();
  } catch {
    return { entries: [] };
  }
}

// ---- Auth ----
export async function registerUser(sessionId, password, nickname = "", question = "", answer = "") {
  try {
    const res = await fetch(`${BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: sessionId, password, nickname, question, answer }),
    });
    return res.json();
  } catch {
    return { ok: false, error: "Could not reach server." };
  }
}
export async function loginUser(sessionId, password) {
  try {
    const res = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: sessionId, password }),
    });
    return res.json();   // ← must return the full json
  } catch {
    return { ok: false, error: "Could not reach server." };
  }
}

export async function getProfile(sessionId) {
  try {
    const res = await fetch(`${BASE_URL}/profile/${sessionId}`);
    if (!res.ok) return { nickname: "" };
    return res.json();
  } catch {
    return { nickname: "" };
  }
}

export async function changePassword(sessionId, oldPassword, newPassword) {
  try {
    const res = await fetch(`${BASE_URL}/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: sessionId, old_password: oldPassword, new_password: newPassword }),
    });
    return res.json();
  } catch {
    return { ok: false, error: "Could not reach server." };
  }
}

export async function clearContent(sessionId, password) {
  try {
    const res = await fetch(`${BASE_URL}/clear-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: sessionId, password }),
    });
    return res.json();
  } catch {
    return { ok: false };
  }
}

export async function deleteAccount(sessionId, password) {
  try {
    const res = await fetch(`${BASE_URL}/delete-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: sessionId, password }),
    });
    return res.json();
  } catch {
    return { ok: false };
  }
}

export async function verifyAnswer(sessionId, answer) {
  try {
    const res = await fetch(`${BASE_URL}/verify-answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: sessionId, answer }),
    });
    return res.json();
  } catch {
    return { ok: false };
  }
}

export async function getReflection(sessionId) {
  try {
    const res = await fetch(`${BASE_URL}/reflection/${sessionId}`);
    if (!res.ok) return { reflection: "" };
    return res.json();
  } catch {
    return { reflection: "" };
  }
}
export async function logPractice(sessionId, practice, visitSession = null) {
  try {
    await fetch(`${BASE_URL}/practice-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: sessionId, practice, session_id: visitSession }),
    });
  } catch {}
}
export async function sendFeedback(sessionId, rating, comment = "") {
  try {
    const res = await fetch(`${BASE_URL}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: sessionId, rating, comment }),
    });
    return res.json();
  } catch { return { ok: false }; }
}
export async function getAdminStats() {
  try {
    const res = await fetch(`${BASE_URL}/admin-stats`);
    return res.json();
  } catch { return {}; }
}
export async function getAdminExtra() {
  try { const r = await fetch(`${BASE_URL}/admin-extra`); return r.json(); } catch { return null; }
}
export async function getAdminUsers() {
  try { const r = await fetch(`${BASE_URL}/admin-users`); return r.json(); } catch { return { users: [] }; }
}
export async function getAdminAssessments() {
  try { const r = await fetch(`${BASE_URL}/admin-assessments`); return r.json(); } catch { return { assessments: [] }; }
}
export async function changeNickname(sessionId, nickname) {
  try {
    const res = await fetch(`${BASE_URL}/change-nickname`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: sessionId, nickname }),
    });
    return res.json();
  } catch { return { ok: false }; }
}
export async function changeUserId(oldId, newId) {
  try {
    const res = await fetch(`${BASE_URL}/change-id`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_id: oldId, new_id: newId }),
    });
    return res.json();
  } catch { return { ok: false }; }
}

export async function setSecurity(user_id, question, answer) {
  try { const r = await fetch(`${BASE_URL}/set-security`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id, question, answer }) }); return r.json(); } catch { return { ok: false }; }
}
export async function forgotQuestion(user_id) {
  try { const r = await fetch(`${BASE_URL}/forgot-question`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id }) }); return r.json(); } catch { return { ok: false }; }
}
export async function forgotReset(user_id, answer, new_password) {
  try { const r = await fetch(`${BASE_URL}/forgot-reset`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id, answer, new_password }) }); return r.json(); } catch { return { ok: false }; }
}

export async function secureAction(sessionId, answer, action) {
  try {
    const res = await fetch(`${BASE_URL}/secure-action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: sessionId, answer, action }),
    });
    return res.json();
  } catch {
    return { ok: false };
  }
}
export async function cancelMessage(sessionId, visitSession, msgId) {
  try {
    const res = await fetch(`${BASE_URL}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: sessionId, session_id: visitSession, msg_id: msgId }),
    });
    return res.json();
  } catch {
    return { ok: false };
  }
}

export async function saveCheckIn(sessionId, mood) {
  const res = await fetch(`${BASE_URL}/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: sessionId, mood }),
  });
  return await res.json();
}

export async function createTestUser(previousId = null) {
  const res = await fetch(`${BASE_URL}/admin-test-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ previous_id: previousId }),
  });
  return await res.json();
}

export async function endSession(sessionId, visitSession) {
  const res = await fetch(`${BASE_URL}/end-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: sessionId, session_id: visitSession }),
  });
  return await res.json();
}

export async function getReport(sessionId) {
  const res = await fetch(`${BASE_URL}/report/${sessionId}`);
  return await res.json();
}