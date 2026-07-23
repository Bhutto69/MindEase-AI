import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminStats, getAdminUsers, getAdminAssessments, ingestBooks, sendMessage, getAdminExtra } from '../services/api';
import { Users, MessageSquare, Activity, Brain, BookOpen, Star, TrendingUp, X, Send } from 'lucide-react';

const ITEMS = {
  Depression: ['depressed_mood','loss_of_interest','appetite_change','sleep_problems','fatigue','psychomotor_change','worthlessness_guilt','concentration_problems'],
  Anxiety: ['nervous_anxious','uncontrollable_worry','excessive_worry','trouble_relaxing','restlessness','irritability','fear_awful'],
  Stress: ['hard_to_wind_down','over_reactive','nervous_energy','agitated','difficult_to_relax','intolerant','touchy'],
};

export default function Admin({ darkMode, sessionId }) {
  const [tab, setTab] = useState('panel');
  const navigate = useNavigate();
  const [s, setS] = useState(null);
  const [modal, setModal] = useState(null);
  const [users, setUsers] = useState([]);
  const [assess, setAssess] = useState([]);
  const [ingesting, setIngesting] = useState(false);
  const [extra, setExtra] = useState(null);
  useEffect(() => { getAdminExtra().then(setExtra); }, []);
  

  // test chat state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [read, setRead] = useState(null);
  const inputRef = React.useRef(null);

  useEffect(() => { getAdminStats().then(setS); }, []);

  const openUsers = async () => { const d = await getAdminUsers(); setUsers(d.users || []); setModal('users'); };
  const openAssess = async () => { const d = await getAdminAssessments(); setAssess(d.assessments || []); setModal('assess'); };

  const send = async () => {
    if (!input.trim() || busy) return;
    const userMsg = { role: 'user', content: input.trim() };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((p) => [...p, userMsg]);
    setInput('');
    setBusy(true);
    inputRef.current?.focus();
    const res = await sendMessage(userMsg.content, [...history, userMsg]);
    setMessages((p) => [...p, { role: 'assistant', content: res.reply }]);
    setRead(res);
    setBusy(false);
    inputRef.current?.focus();
  };

  const card = darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-lg shadow-slate-200/40';
  const c = darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';

  const tabBtn = (id, label) =>
    <button onClick={() => setTab(id)}
      className={`px-5 py-2 rounded-xl font-bold text-sm transition ${tab === id ? 'bg-indigo-600 text-white' : (darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-600')}`}>
      {label}
    </button>;

  return (
    <div className={`p-8 min-h-screen ${darkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <div className="flex gap-3 mb-6">
        {tabBtn('panel', '🛡️ Admin Panel')}
        {tabBtn('test', '🧪 Test Chat')}
        <button onClick={() => navigate('/chat')}
          className={`px-5 py-2 rounded-xl font-bold text-sm transition ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
          👁️ User View
        </button>
      </div>

      {tab === 'panel' && (!s ? <p className="text-slate-500">Loading admin data...</p> : (() => {
        const engagement = s.messages > 0 && s.analyses > 0
          ? Math.min(100, Math.round((s.analyses / Math.max(s.messages, 1)) * 100)) : 0;
        const cards = [
          { label: 'Total Users', val: s.users, icon: <Users size={22} />, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/30', onClick: openUsers },
          { label: 'Sessions', val: s.sessions, icon: <Activity size={22} />, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
          { label: 'User Messages', val: s.messages, icon: <MessageSquare size={22} />, color: 'text-sky-500', bg: 'bg-sky-50 dark:bg-sky-900/30' },
          { label: 'Assessments', val: s.analyses, icon: <Brain size={22} />, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/30', onClick: openAssess },
          { label: 'Journal Entries', val: s.journals, icon: <BookOpen size={22} />, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30' },
          { label: 'Avg Rating', val: `${s.avg_rating}/5`, icon: <Star size={22} />, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/30' },
        ];
        const doIngest = async () => {
          setIngesting(true);
          try { await ingestBooks(); setModal(null); alert('Books ingested successfully!'); }
          catch { alert('Ingest failed.'); }
          setIngesting(false);
        };
        return (
          <>
            <h1 className="text-4xl font-black mb-2 flex items-center gap-3">Admin Panel 🛡️</h1>
            <p className="text-slate-500 font-medium mb-8">System overview & user engagement insights.</p>

            <button onClick={doIngest} disabled={ingesting}
              className="mb-8 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-60">
              {ingesting ? 'Ingesting books...' : '📚 Ingest Books'}
            </button>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mb-8">
              {cards.map((cd) => (
                <div key={cd.label} onClick={cd.onClick}
                  className={`p-6 rounded-3xl border-2 ${card} ${cd.onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${cd.bg} ${cd.color}`}>{cd.icon}</div>
                  <p className="text-slate-500 font-bold text-sm">{cd.label}{cd.onClick ? ' ↗' : ''}</p>
                  <p className="text-3xl font-black mt-1">{cd.val}</p>
                </div>
              ))}
            </div>

            <div className={`p-6 rounded-3xl border-2 mb-8 ${card}`}>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={20} className="text-emerald-500" />
                <p className="font-black text-lg">Engagement Signal</p>
              </div>
              <p className="text-sm text-slate-500 mb-3">Assessment-to-message ratio — higher means users are genuinely engaging, not spamming.</p>
              <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${engagement}%` }} />
              </div>
              <p className="text-right text-sm font-bold mt-2">{engagement}% genuine engagement</p>
            </div>

            <div className="grid grid-cols-3 gap-5 mb-8">
              {[['Active (7d)', s.active7], ['Returning Users', s.returning], ['Peak Hour', s.peak_hour]].map(([l, v]) => (
                <div key={l} className={`p-5 rounded-2xl border-2 text-center ${card}`}>
                  <p className="text-slate-500 font-bold text-xs">{l}</p>
                  <p className="text-2xl font-black mt-1">{v}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className={`p-6 rounded-3xl border-2 ${card}`}>
                <p className="font-black text-lg mb-3">🏋️ Most-Practiced Exercises</p>
                {s.practices.length === 0 ? <p className="text-slate-400 text-sm">None yet.</p> :
                  s.practices.map((p) => (
                    <div key={p.name} className="flex justify-between text-sm mb-1">
                      <span>{p.name}</span><span className="font-bold text-emerald-500">{p.count}×</span>
                    </div>
                  ))}
              </div>
              
              <div className={`p-6 rounded-3xl border-2 ${card}`}>
                <p className="font-black text-lg mb-3">⚠️ Top Symptoms Detected</p>
                {s.top_symptoms.length === 0 ? <p className="text-slate-400 text-sm">None yet.</p> :
                  s.top_symptoms.map((sy) => (
                    <div key={sy.name} className="flex justify-between text-sm mb-1">
                      <span className="capitalize">{sy.name}</span><span className="font-bold text-violet-500">{sy.count}</span>
                    </div>
                  ))}
              </div>
              <div className={`p-6 rounded-3xl border-2 ${card}`}>
                <p className="font-black text-lg mb-3">📊 Avg Severity (per user)</p>
                <div className="flex justify-between text-sm mb-1"><span>Depression</span><span className="font-bold text-blue-500">{s.avg_severity.dep}/24</span></div>
                <div className="flex justify-between text-sm mb-1"><span>Anxiety</span><span className="font-bold text-rose-500">{s.avg_severity.anx}/21</span></div>
                <div className="flex justify-between text-sm"><span>Stress</span><span className="font-bold text-amber-500">{s.avg_severity.str*2}/42</span></div>
              </div>
              <div className={`p-6 rounded-3xl border-2 ${card}`}>
                <p className="font-black text-lg mb-3">🎭 Mood Distribution</p>
                {s.mood_dist.length === 0 ? <p className="text-slate-400 text-sm">None yet.</p> :
                  s.mood_dist.map((m) => (
                    <div key={m.mood} className="flex justify-between text-sm mb-1">
                      <span className="capitalize">{m.mood}</span><span className="font-bold text-indigo-500">{m.count}</span>
                    </div>
                  ))}
              </div>
            </div>

            {extra && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                <div className={`p-6 rounded-3xl border-2 ${card}`}>
                  <p className="font-black text-lg mb-1">🚨 Crisis Events</p>
                  <p className="text-4xl font-black text-red-500">{extra.crises}</p>
                  <p className="text-xs text-slate-500 mt-1">Times the crisis system flagged a user.</p>
                </div>
                <div className={`p-6 rounded-3xl border-2 ${card}`}>
                  <p className="font-black text-lg mb-1">🌱 Practice Impact</p>
                  {extra.impact.users < 3 ? (
                    <p className="text-sm text-slate-400 mt-2">Collecting data — need ≥3 users with before & after readings ({extra.impact.users} so far).</p>
                  ) : (
                    <>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="text-center">
                          <p className="text-2xl font-black text-amber-500">{extra.impact.before}%</p>
                          <p className="text-[10px] text-slate-500">before</p>
                        </div>
                        <span className="text-slate-400">→</span>
                        <div className="text-center">
                          <p className="text-2xl font-black text-emerald-500">{extra.impact.after}%</p>
                          <p className="text-[10px] text-slate-500">after</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Per-user: avg distress rate before vs after their first practice. {extra.impact.improved}/{extra.impact.users} users improved.</p>
                    </>
                  )}
                </div>
              </div>
            )}

            <h2 className="text-2xl font-black mb-4">Recent Feedback</h2>
            <div className="space-y-3">
              {s.feedback.length === 0 ? <p className="text-slate-500">No feedback yet.</p> :
                s.feedback.map((f, i) => (
                  <div key={i} className={`p-5 rounded-2xl border-2 ${card}`}>
                    <p className="font-bold text-amber-500 text-lg">{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</p>
                    {f.comment && <p className="text-sm mt-1">{f.comment}</p>}
                    <p className="text-xs text-slate-400 mt-1">{f.ts}</p>
                  </div>
                ))}
            </div>
          </>
        );
      })())}

      {tab === 'test' && (
        <>
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-3xl font-black">Test Chat 🧪</h1>
            <button
              onClick={() => { setMessages([]); setRead(null); setInput(''); setBusy(false); }}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition ${darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
              ↻ New Chat
            </button>
          </div>
          {read?.crisis && (
            <div className="mb-6 p-4 rounded-xl bg-red-500 text-white font-bold">
              🚨 Crisis detected — Umang: 0311-7786264 · National Youth Helpline: 0800-69457 · Emergency: 1122
            </div>
          )}
          <p className="text-slate-500 mb-6 text-sm">Chat with the AI to see what the Analyst detects live. Nothing here is saved.</p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={`lg:col-span-2 rounded-2xl border-2 p-5 flex flex-col ${c}`} style={{ height: '70vh' }}>
              <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                {messages.length === 0 && <p className="text-slate-400 text-sm">Send a message to begin testing...</p>}
                {messages.map((m, i) => (
                  <div key={i} className={`p-3 rounded-xl max-w-[80%] ${m.role === 'user' ? 'ml-auto bg-indigo-600 text-white' : (darkMode ? 'bg-slate-800' : 'bg-slate-100')}`}>
                    {m.content}
                  </div>
                ))}
                {busy && <p className="text-slate-400 text-sm">Thinking...</p>}
              </div>
              <div className="flex gap-2">
                <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder="Type a test message..."
                  className={`flex-1 p-3 rounded-xl outline-none border ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`} />
                <button onClick={send} disabled={busy} className="px-5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-60">
                  <Send size={18} />
                </button>
              </div>
            </div>

            <div className={`rounded-2xl border-2 p-5 ${c}`}>
              <div className="flex items-center gap-2 mb-4">
                <Activity size={20} className="text-emerald-500" />
                <p className="font-black text-lg">Live Assessment</p>
              </div>
              {!read ? (
                <p className="text-slate-400 text-sm">Analyst readings will appear here after the first message.</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Mood</p>
                    <p className="font-bold capitalize">{read.mood}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Books Consulted</p>
                    {read.sources && read.sources.length > 0 ?
                      read.sources.map((s, i) => <p key={i} className="text-xs text-emerald-600 font-medium">📚 {s.source}</p>) :
                      <p className="text-slate-400 text-sm">None this reply</p>}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Needs Support</p>
                    <p className="font-bold">{read.needs_support ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Symptoms Detected ({read.symptoms.length})</p>
                    {read.symptoms.length === 0 ? <p className="text-slate-400 text-sm">None yet</p> :
                      read.symptoms.map((sym, i) => <p key={i} className="text-sm">• {sym.replace(/_/g, ' ')}</p>)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Severity (0-3)</p>
                    {(read.severity ? Object.entries(read.severity) : []).length === 0 ? <p className="text-slate-400 text-sm">None yet</p> :
                      Object.entries(read.severity).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-sm">
                          <span>{k.replace(/_/g, ' ')}</span>
                          <span className="font-bold">{v}/3</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-2 mt-4">Questionnaire Progress</p>
                {read?.picture && (
                  <div className={`mb-3 p-2 rounded-lg text-xs ${darkMode ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
                    {Object.entries(read.picture).map(([scale, p]) => (
                      <div key={scale} className="flex justify-between">
                        <span>{scale}</span>
                        <span className="font-bold">{p.score}/{p.max} · {p.band}</span>
                      </div>
                    ))}
                    {read.primary && <div className="mt-1 text-indigo-500 font-bold">🎯 Target: {read.primary}</div>}
                  </div>
                )}
                {Object.entries(ITEMS).map(([group, keys]) => {
                  const done = keys.filter((k) => (read?.symptoms || []).includes(k) || (read?.severity && read.severity[k] !== undefined));
                  return (
                    <div key={group} className="mb-3">
                      <p className="text-sm font-bold">{group} ({done.length}/{keys.length})</p>
                      {keys.map((k) => {
                        const ticked = done.includes(k);
                        return (
                          <p key={k} className={`text-xs ${ticked ? 'text-emerald-500 font-bold' : 'text-slate-400'}`}>
                            {ticked ? '☑' : '☐'} {k.replace(/_/g, ' ')}
                          </p>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}


      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" onClick={() => setModal(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-3xl p-6 bg-white text-slate-900">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black">{modal === 'users' ? 'User IDs' : 'Assessments (anonymized)'}</h3>
              <button onClick={() => setModal(null)}><X size={22} /></button>
            </div>
            {modal === 'users' ? (
              <div className="space-y-2">
                {users.length === 0 ? <p className="text-slate-500">No users.</p> :
                  users.map((u, i) => <p key={i} className="font-mono text-sm p-2 rounded-lg bg-slate-100 text-slate-900">{u}</p>)}
              </div>
            ) : (
              <div className="space-y-2">
                {assess.length === 0 ? <p className="text-slate-500">No assessments.</p> :
                  assess.map((a, i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-100 text-slate-900 text-sm">
                      <p className="font-bold mb-1">{a.label} · {a.symptoms} symptoms detected</p>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <div className="bg-blue-100 rounded-lg p-2 text-center">
                          <p className="font-black text-blue-700">{a.depression}/24</p>
                          <p className="text-[10px] text-blue-500 font-bold">{a.dep_band}</p>
                        </div>
                        <div className="bg-rose-100 rounded-lg p-2 text-center">
                          <p className="text-xs text-rose-600 font-bold">Anxiety</p>
                          <p className="font-black text-rose-700">{a.anxiety}/18</p>
                        </div>
                        <div className="bg-amber-100 rounded-lg p-2 text-center">
                          <p className="text-xs text-amber-600 font-bold">Stress</p>
                          <p className="font-black text-amber-700">{a.stress}/18</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}