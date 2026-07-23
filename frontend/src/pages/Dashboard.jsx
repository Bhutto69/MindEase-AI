import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { MessageSquare, Lock, Sparkles, Heart } from 'lucide-react';
import { getAnalytics, getSessions, saveCheckIn } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';

// How many sessions before the picture is shown, and how often it refreshes.
const BLOCK = 3;

// Plain-language names for the clinical item keys. Never shown as scores.
const THEME_NAMES = {
  sleep_problems: 'sleep',
  anxiety_sleep_problems: 'sleep',
  fatigue: 'energy',
  loss_of_interest: 'motivation',
  depressed_mood: 'low mood',
  appetite_change: 'appetite',
  worthlessness_guilt: 'being hard on yourself',
  concentration_problems: 'focus',
  psychomotor_change: 'restlessness',
  nervous_anxious: 'feeling on edge',
  uncontrollable_worry: 'worry',
  excessive_worry: 'worry',
  trouble_relaxing: 'winding down',
  restlessness: 'restlessness',
  irritability: 'irritability',
  fear_awful: 'worry about what might happen',
  hard_to_wind_down: 'winding down',
  over_reactive: 'feeling reactive',
  nervous_energy: 'nervous energy',
  agitated: 'feeling wound up',
  difficult_to_relax: 'winding down',
  intolerant: 'patience',
  touchy: 'sensitivity',
};

export default function Dashboard({ darkMode, sessionId, isAdmin }) {
  const [analyses, setAnalyses] = useState([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [checkInMessage, setCheckInMessage] = useState('');
  const [selectedMood, setSelectedMood] = useState(null);

  const load = () => {
    if (!sessionId) return;
    getAnalytics(sessionId).then((d) => setAnalyses(d.analyses || []));
    getSessions(sessionId).then((d) => setSessionCount((d.sessions || []).length));
  };

  useEffect(load, [sessionId]);

  const handleCheckIn = async (mood) => {
    setSelectedMood(mood);
    const responses = {
      super: "Love that. Glad today's been a good one. ✨",
      happy: "Nice — thanks for letting me know. 😊",
      meh: "Some days are just like that. Thanks for checking in. 💙",
      stressed: "That sounds heavy. Glad you told me. 🤗",
    };
    setCheckInMessage(responses[mood]);
    try {
      await saveCheckIn(sessionId, mood);
      load();                      // check-in becomes a real point on the trend
    } catch (e) {
      console.error('check-in failed', e);
    }
  };

  const textClass = darkMode ? 'text-white' : 'text-slate-950';
  const cardClass = `p-10 rounded-[3rem] border-2 transition-all ${
    darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50'
  }`;

  // ---- Group analyses into ordered sessions, then into blocks of 3 ----
  const moodMap = { low: 2, neutral: 3, positive: 4 };
  const order = [];
  const bySession = {};
  analyses.forEach((a) => {
    const key = a.session_id || 'unsessioned';
    if (!bySession[key]) { bySession[key] = []; order.push(key); }
    bySession[key].push(a);
  });

  // Admins see everything message-by-message, ungated — this view is for testing.
  const completedBlocks = Math.floor(order.length / BLOCK);
  const unlocked = isAdmin ? order.length > 0 : completedBlocks >= 1;

 // Only sessions inside a COMPLETED block are shown, so the picture holds
  // steady until the next block of 3 finishes.
  const shownKeys = isAdmin ? order : order.slice(0, completedBlocks * BLOCK);

  // One point per analysis row — every message the Analyst read.
  // This is what makes the curve move within a session.
  const points = [];
  const boundaries = [];
  shownKeys.forEach((key, sIdx) => {
    if (sIdx > 0) boundaries.push(points.length - 0.5);
    bySession[key].forEach((a) => {
      points.push({
        idx: points.length,
        mood: moodMap[a.mood] ?? 3,
        session: sIdx + 1,
        label: `Session ${sIdx + 1}`,
        checkIn: (a.signals || []).includes('self check-in'),
      });
    });
  });

  // Session averages — used by themes and "steadiest stretch" only.
  const blocks = shownKeys.map((key, i) => {
    const rows = bySession[key];
    const vals = rows.map((a) => moodMap[a.mood] ?? 3);
    return {
      label: `Session ${i + 1}`,
      mood: Math.round((vals.reduce((s, v) => s + v, 0) / (vals.length || 1)) * 10) / 10,
      rows,
    };
  });

  // Themes come only from unlocked blocks, so nothing appears early.
  const themeCount = {};
  blocks.flatMap((bl) => bl.rows).forEach((a) => {
    (a.symptoms || []).forEach((k) => {
      const name = THEME_NAMES[k];
      if (name) themeCount[name] = (themeCount[name] || 0) + 1;
    });
  });
  const themes = Object.entries(themeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  const steadiest = blocks.length
    ? blocks.reduce((best, b) => (b.mood > best.mood ? b : best), blocks[0])
    : null;

  const sessionsIntoBlock = order.length % BLOCK;
  const nextAt = (completedBlocks + 1) * BLOCK;
  const navigate = useNavigate();

  return (
    <div className={`p-8 min-h-screen transition-colors duration-500 ${darkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>

      <h1 className={`text-4xl font-black mb-2 flex items-center gap-3 ${textClass}`}>
        Analytics 📈
      </h1>
      <p className="text-slate-500 font-medium mb-10">
        A quiet look at how things have been going.
      </p>

      {/* ---- ALWAYS VISIBLE ---- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <div className={`p-6 rounded-3xl border-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50'}`}>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
            <MessageSquare size={20} className="text-indigo-600" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-bold text-sm mb-1">Total Sessions</p>
          <h4 className={`text-3xl font-black ${textClass}`}>{order.length}</h4>
        </div>

        <div className={`p-6 rounded-3xl border-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50'}`}>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
            <Heart size={20} className="text-emerald-500" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-bold text-sm mb-1">Check-ins</p>
          <h4 className={`text-3xl font-black ${textClass}`}>
            {analyses.filter((a) => (a.signals || []).includes('self check-in')).length}
          </h4>
        </div>
      </div>

      {/* ---- LOCKED STATE ---- */}
      {!unlocked && (
        <div className={`${cardClass} mb-8 text-center`}>
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-6">
            <Lock size={26} className="text-indigo-500" />
          </div>
          <h3 className={`text-2xl font-black mb-3 ${textClass}`}>Building your picture</h3>
          <p className="text-slate-500 font-medium max-w-md mx-auto mb-6">
            We take our time here. After a few conversations there's enough to show you
            something meaningful — until then, it wouldn't really mean much.
          </p>
          <p className="font-black text-indigo-500 text-lg">
            Session {order.length} of {BLOCK}
          </p>
          <div className="w-full max-w-xs mx-auto h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-4">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (order.length / BLOCK) * 100)}%` }}
              transition={{ duration: 0.8 }}
              className="h-full bg-indigo-500 rounded-full"
            />
          </div>
        </div>
      )}

      {/* ---- UNLOCKED ---- */}
      {unlocked && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">

          <div className={`lg:col-span-2 ${cardClass}`}>
            <h3 className={`text-2xl font-black mb-2 ${textClass}`}>How things have felt 🌊</h3>
            <p className="text-slate-500 text-sm font-medium mb-8">
              How things moved across each conversation — next update at session {nextAt}.
            </p>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ left: 20 }}>
                  <defs>
                    <linearGradient id="colorMood" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#334155' : '#e2e8f0'} />
                  {boundaries.map((b, i) => (
                    <ReferenceLine key={i} x={b} stroke={darkMode ? '#475569' : '#cbd5e1'} strokeDasharray="4 4" />
                  ))}
                  <XAxis
                    dataKey="idx"
                    axisLine={false}
                    tickLine={false}
                    ticks={blocks.map((_, i) => points.find((p) => p.session === i + 1)?.idx ?? 0)}
                    tickFormatter={(v) => points[v]?.label ?? ''}
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    domain={[1.6, 4.4]}
                    ticks={[2, 3, 4]}
                    tickFormatter={(v) => ['Heavy 😔', 'Steady 😐', 'Bright 😊'][v - 2]}
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '20px', backgroundColor: darkMode ? '#0f172a' : '#fff', border: 'none', fontWeight: 'bold' }}
                    labelFormatter={(v) => points[v]?.label ?? ''}
                    formatter={(val, _n, p) => [
                      ['', 'Heavy', 'Steady', 'Bright'][Math.round(val) - 1] ?? 'Steady',
                      p.payload.checkIn ? 'Your check-in' : 'From conversation',
                    ]}
                  />
                  <Area type="monotone" dataKey="mood" stroke="#6366f1" strokeWidth={4}
                        fillOpacity={1} fill="url(#colorMood)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={cardClass}>
            <h3 className={`text-2xl font-black mb-2 ${textClass}`}>What's come up</h3>
            <p className="text-slate-500 text-sm font-medium mb-8">
              Things you've mentioned more than once.
            </p>
            {themes.length === 0 ? (
              <p className="text-slate-400 font-medium">Nothing's stood out so far.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {themes.map((t, i) => (
                  <motion.span
                    key={t}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.08 }}
                    className="px-5 py-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 font-bold"
                  >
                    {t}
                  </motion.span>
                ))}
              </div>
            )}

            {steadiest && blocks.length > 1 && (
              <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={16} className="text-emerald-500" />
                  <span className="text-slate-500 font-bold text-sm">Your steadiest stretch</span>
                </div>
                <p className={`font-black text-lg ${textClass}`}>{steadiest.label}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- SHAREABLE SUMMARY ---- */}
      {(isAdmin || completedBlocks >= 2) && (
        <div className={`${cardClass} mb-8 flex items-center justify-between gap-6 flex-wrap`}>
          <div>
            <h3 className={`text-2xl font-black mb-2 ${textClass}`}>Taking this further?</h3>
            <p className="text-slate-500 font-medium max-w-lg">
              If you ever want to talk to someone, you can take a summary of what's come up
              with you. It's yours — read it first, and share it only if you want to.
            </p>
          </div>
          <button onClick={() => navigate('/report')}
            className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition shrink-0">
            <FileText size={18}/> Prepare a summary
          </button>
        </div>
      )}

      {/* ---- CHECK-IN (always) ---- */}
      <div className={cardClass}>
        <h3 className={`text-2xl font-black mb-2 ${textClass}`}>How are you right now?</h3>
        <p className="text-slate-500 text-sm font-medium mb-8">
          Whenever you feel like it — it all counts.
        </p>

        <AnimatePresence mode="wait">
          {checkInMessage && (
            <motion.div
              key={selectedMood}
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`mb-8 p-6 rounded-[2rem] border-2 font-bold text-lg text-center ${
                selectedMood === 'super' || selectedMood === 'happy'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-indigo-50 border-indigo-200 text-indigo-700'
              }`}
            >
              {checkInMessage}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {['super', 'happy', 'meh', 'stressed'].map((mood) => (
            <button
              key={mood} onClick={() => handleCheckIn(mood)}
              className={`p-8 border-2 rounded-[2rem] transition-all font-black text-xl hover:scale-105 active:scale-95 ${
                selectedMood === mood
                  ? 'bg-indigo-600 text-white border-transparent'
                  : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-400'
              }`}
            >
              {mood === 'super' && 'Great 🤩'}
              {mood === 'happy' && 'Good 😊'}
              {mood === 'meh' && 'Okay 😐'}
              {mood === 'stressed' && 'Rough 😫'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}