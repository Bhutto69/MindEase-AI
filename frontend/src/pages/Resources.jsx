import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind, X, ArrowRight, FileText, Anchor, Moon, Palette, Sparkles, Layout, Heart, Sun, RefreshCw, BookOpen, Coffee, Smile } from 'lucide-react';
import { logPractice } from '../services/api';

const QUOTES = [
  { text: "You don't have to control your thoughts. You just have to stop letting them control you.", author: "Dan Millman" },
  { text: "Almost everything will work again if you unplug it for a few minutes — including you.", author: "Anne Lamott" },
  { text: "You are allowed to be both a masterpiece and a work in progress at the same time.", author: "Sophia Bush" },
  { text: "Rest is not a reward for work completed. It is a requirement for work to be done.", author: "Unknown" },
  { text: "Feelings are just visitors. Let them come and go.", author: "Mooji" },
  { text: "You have survived 100% of your worst days. You're doing better than you think.", author: "Unknown" },
  { text: "Be patient with yourself. Nothing in nature blooms all year.", author: "Unknown" },
  { text: "Asking for help is not giving up. It's refusing to give up.", author: "Unknown" },
  { text: "Your current situation is not your final destination. The best is yet to come.", author: "Unknown" },
  { text: "Small steps every day add up to big changes. Just keep going.", author: "Unknown" },
];

const READS = [
  { icon: <Coffee size={20} />, title: "Why rest isn't lazy", tip: "Taking breaks actually improves focus and mood. Rest is productive — your brain needs downtime to recover and process." },
  { icon: <Smile size={20} />, title: "The 3-good-things habit", tip: "Each night, note 3 things that went okay today, however small. Over weeks, this gently trains your mind to notice the good." },
  { icon: <Wind size={20} />, title: "Anxiety loves avoidance", tip: "The more we avoid what scares us, the bigger it feels. Small, gentle steps toward it slowly shrink the fear." },
  { icon: <Heart size={20} />, title: "Talk to yourself like a friend", tip: "You'd never tell a friend 'you're worthless.' Notice your self-talk — and try offering yourself the same kindness." },
];

export default function Resources({ darkMode, sessionId }) {
  const [zenMode, setZenMode] = useState(false);
  const [breathText, setBreathText] = useState("Breathe In...");
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * QUOTES.length));

  useEffect(() => {
    let interval;
    if (zenMode) {
      setBreathText("Breathe In...");
      interval = setInterval(() => {
        setBreathText((prev) => (prev === "Breathe In..." ? "Breathe Out..." : "Breathe In..."));
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [zenMode]);

  const nextQuote = () => setQuoteIndex((i) => (i + 1) % QUOTES.length);

  const exercises = [
    {
      id: 1, title: "Thought Reframing", tag: "CBT", time: "10 min",
      description: "Learn to challenge negative thought patterns.",
      evidence: "Evidence-based · Core CBT technique",
      icon: <FileText size={24} />,
      theme: { bg: "bg-emerald-50", text: "text-emerald-900", btn: "bg-emerald-200 text-emerald-800 hover:bg-emerald-300" },
      content: [
        "1. Identify the Situation: What happened to make you feel this way?",
        "2. Catch the Thought: What exactly were you telling yourself?",
        "3. Evaluate Evidence: Is this thought 100% true? What evidence do you have against it?",
        "4. Reframe: Create a new, balanced thought that aligns with the facts.",
      ],
    },
    {
      id: 2, title: "Grounding Exercise", tag: "Anxiety", time: "3 min",
      description: "5-4-3-2-1 technique for managing panic and anxiety.",
      evidence: "Clinically used for panic & anxiety",
      icon: <Anchor size={24} />,
      theme: { bg: "bg-rose-50", text: "text-rose-900", btn: "bg-rose-200 text-rose-800 hover:bg-rose-300" },
      content: [
        "👀 Acknowledge 5 things you see around you.",
        "✋ Acknowledge 4 things you can touch.",
        "👂 Acknowledge 3 things you can hear.",
        "👃 Acknowledge 2 things you can smell.",
        "👅 Acknowledge 1 thing you can taste.",
      ],
    },
    {
      id: 3, title: "Sleep Hygiene", tag: "Sleep", time: "Guide",
      description: "Practical tips for better sleep quality.",
      evidence: "Standard clinical sleep guidance",
      icon: <Moon size={24} />,
      theme: { bg: "bg-violet-50", text: "text-violet-900", btn: "bg-violet-200 text-violet-800 hover:bg-violet-300" },
      content: [
        "• Stick to a consistent sleep schedule, even on weekends.",
        "• Create a relaxing bedtime routine (reading, warm bath).",
        "• Limit exposure to screens (blue light) an hour before bed.",
        "• Keep your bedroom cool, dark, and quiet.",
      ],
    },
    {
      id: 4, title: "Creative Expression", tag: "Self-Care", time: "Flexible",
      description: "Use art and creativity for emotional processing.",
      evidence: "Supports emotional processing",
      icon: <Palette size={24} />,
      theme: { bg: "bg-amber-50", text: "text-amber-900", btn: "bg-amber-200 text-amber-800 hover:bg-amber-300" },
      content: [
        "• Free Writing: Write continuously for 5 minutes without stopping.",
        "• Color Mapping: Draw your current emotions as colors/shapes.",
        "• Collage: Create a visual representation of how you want to feel.",
        "• No judgment allowed—focus on the process, not the result.",
      ],
    },
    {
      id: 5, title: "Box Breathing", tag: "Calm", time: "4 min",
      description: "A simple rhythm used to calm the nervous system fast.",
      evidence: "Calms the nervous system",
      icon: <Wind size={24} />,
      theme: { bg: "bg-sky-50", text: "text-sky-900", btn: "bg-sky-200 text-sky-800 hover:bg-sky-300" },
      content: [
        "1. Breathe IN slowly for 4 seconds.",
        "2. HOLD your breath for 4 seconds.",
        "3. Breathe OUT slowly for 4 seconds.",
        "4. HOLD empty for 4 seconds. Repeat 4 times.",
      ],
    },
    {
      id: 6, title: "Gratitude Practice", tag: "Mood", time: "5 min",
      description: "Gently shift focus toward what's going right.",
      evidence: "Research-backed for mood",
      icon: <Sun size={24} />,
      theme: { bg: "bg-orange-50", text: "text-orange-900", btn: "bg-orange-200 text-orange-800 hover:bg-orange-300" },
      content: [
        "• Name 3 things you're grateful for today, big or small.",
        "• Recall one person who made your day a little easier.",
        "• Notice one thing your body did for you today.",
        "• Let yourself sit with the good feeling for a moment.",
      ],
    },
    {
      id: 7, title: "Self-Compassion Break", tag: "Kindness", time: "5 min",
      description: "Meet your own pain with the kindness you'd give a friend.",
      evidence: "RCT-proven · Neff & Germer",
      icon: <Heart size={24} />,
      theme: { bg: "bg-pink-50", text: "text-pink-900", btn: "bg-pink-200 text-pink-800 hover:bg-pink-300" },
      content: [
        "1. Acknowledge: 'This is a moment of difficulty.'",
        "2. Normalize: 'Difficulty is part of being human. I'm not alone.'",
        "3. Soothe: Place a hand on your heart, breathe.",
        "4. Offer kindness: 'May I be gentle with myself right now.'",
      ],
    },
  ];

  return (
    <div className={`p-8 min-h-screen transition-colors duration-500 ${darkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-950'}`}>

      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
        <h1 className={`text-3xl font-bold flex items-center gap-3 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
          Wellness Sanctuary <Layout className="text-indigo-500" size={32} />
        </h1>
        <button onClick={() => setZenMode(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2">
          <Sparkles size={18} /> Start Zen Mode
        </button>
      </div>

      {/* MOTIVATIONAL QUOTE CARD */}
      <motion.div
        className={`rounded-[2rem] p-8 mb-8 border-2 relative overflow-hidden ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-lg shadow-slate-200/40'}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-3">A thought for you 💭</p>
            <AnimatePresence mode="wait">
              <motion.div key={quoteIndex} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <p className={`text-xl md:text-2xl font-bold leading-relaxed ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                  "{QUOTES[quoteIndex].text}"
                </p>
                <p className="text-sm text-slate-400 mt-3 font-medium">— {QUOTES[quoteIndex].author}</p>
              </motion.div>
            </AnimatePresence>
          </div>
          <button onClick={nextQuote} title="Another quote"
            className={`p-3 rounded-full shrink-0 transition-colors ${darkMode ? 'bg-slate-800 text-indigo-300 hover:bg-slate-700' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>
            <RefreshCw size={18} />
          </button>
        </div>
      </motion.div>

      {/* IMMEDIATE RELIEF */}
      <motion.div whileHover={{ y: -5 }} onClick={() => setZenMode(true)}
        className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-[2rem] p-10 text-white shadow-xl shadow-indigo-500/20 cursor-pointer relative overflow-hidden mb-12">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <Wind size={40} className="mb-6 opacity-90" />
            <h2 className="text-3xl font-bold mb-2">Immediate Relief</h2>
            <p className="text-indigo-100 opacity-90 font-medium text-lg max-w-xl">
              Feeling overwhelmed? Tap here to start a guided breathing session to reset your nervous system.
            </p>
          </div>
          <div className="mt-6 md:mt-0 bg-white/20 backdrop-blur-md px-6 py-3 rounded-xl font-bold flex items-center gap-2">
            Begin Session <ArrowRight size={20} />
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
      </motion.div>

      {/* EXERCISES */}
      <h2 className={`text-2xl font-black mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>Therapeutic Practices</h2>
      <p className={`mb-6 text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        Every practice below is grounded in evidence-based clinical research. ✓
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {exercises.map((ex) => (
          <motion.div key={ex.id} whileHover={{ y: -5 }}
            className={`p-8 rounded-[2rem] border-2 transition-all relative ${darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 shadow-lg shadow-slate-200/40'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${darkMode ? 'bg-slate-800 text-white' : ex.theme.bg + ' ' + ex.theme.text}`}>
                {ex.icon}
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'}`}>{ex.time}</span>
            </div>
            <div className="mb-4">
              <h3 className="text-xl font-bold mb-1">{ex.title}</h3>
              <span className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-indigo-400' : ex.theme.text.replace('900', '500')}`}>{ex.tag}</span>
            </div>
            <p className={`mb-4 font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{ex.description}</p>
            {ex.evidence && (
              <div className={`inline-flex items-center gap-1.5 mb-6 px-3 py-1.5 rounded-full text-xs font-bold ${darkMode ? 'bg-emerald-900/30 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                <span className="text-[10px]">✓</span> {ex.evidence}
              </div>
            )}
            <button onClick={() => setSelectedExercise(ex)}
              className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${darkMode ? 'bg-slate-800 hover:bg-slate-700 text-white' : ex.theme.btn}`}>
              Start Exercise <ArrowRight size={16} />
            </button>
          </motion.div>
        ))}
      </div>

      {/* HELPFUL READS */}
      <h2 className={`text-2xl font-black mb-2 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
        <BookOpen size={24} className="text-indigo-500" /> Helpful Reads
      </h2>
      <p className={`mb-6 text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        Grounded in CBT and wellbeing research. ✓
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {READS.map((r, i) => (
          <div key={i} className={`p-6 rounded-2xl border-2 flex gap-4 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-md shadow-slate-200/30'}`}>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${darkMode ? 'bg-slate-800 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
              {r.icon}
            </div>
            <div>
              <p className={`font-bold mb-1 ${darkMode ? 'text-white' : 'text-slate-900'}`}>{r.title}</p>
              <p className={`text-sm leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{r.tip}</p>
            </div>
          </div>
        ))}
      </div>

      {/* EXERCISE MODAL */}
      <AnimatePresence>
        {selectedExercise && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className={`w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative ${darkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
              <button onClick={() => setSelectedExercise(null)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X size={24} className={darkMode ? 'text-white' : 'text-slate-900'} />
              </button>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${darkMode ? 'bg-slate-800 text-white' : selectedExercise.theme.bg + ' ' + selectedExercise.theme.text}`}>
                {selectedExercise.icon}
              </div>
              <h2 className={`text-3xl font-black mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>{selectedExercise.title}</h2>
              <p className="text-slate-500 font-bold mb-3 uppercase tracking-wider text-xs">{selectedExercise.tag} • {selectedExercise.time}</p>
              {selectedExercise.evidence && (
                <div className={`inline-flex items-center gap-1.5 mb-6 px-3 py-1.5 rounded-full text-xs font-bold ${darkMode ? 'bg-emerald-900/30 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                  <span className="text-[10px]">✓</span> {selectedExercise.evidence}
                </div>
              )}
              <div className={`p-6 rounded-3xl mb-8 ${darkMode ? 'bg-slate-800' : selectedExercise.theme.bg}`}>
                <ul className="space-y-4">
                  {selectedExercise.content.map((step, i) => (
                    <li key={i} className={`font-medium text-lg leading-relaxed ${darkMode ? 'text-slate-200' : selectedExercise.theme.text}`}>{step}</li>
                  ))}
                </ul>
              </div>
              <button onClick={() => { if (sessionId) logPractice(sessionId, selectedExercise.title); setSelectedExercise(null); }}
                className={`w-full py-4 rounded-xl font-bold shadow-lg transition-transform active:scale-95 ${darkMode ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                Complete Exercise Check-in 
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ZEN MODE */}
      <AnimatePresence>
        {zenMode && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`fixed inset-0 z-[100] flex flex-col items-center justify-center ${darkMode ? 'bg-slate-950' : 'bg-white'}`}>
            <div className="absolute top-8 left-8 right-8 flex justify-between items-center">
              <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">Wellness Sanctuary <span className="text-indigo-500">Zen Mode</span></h2>
              <button onClick={() => { if (sessionId) logPractice(sessionId, 'Immediate Relief breathing'); setZenMode(false); }} className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2">Exit Zen <X size={20} /></button>
            </div>
            <div className="relative flex items-center justify-center">
              <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.1, 0.3] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="absolute w-96 h-96 rounded-full bg-indigo-500/20 blur-3xl" />
              <motion.div animate={{ scale: [1, 1.25, 1] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="w-64 h-64 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-full shadow-[0_0_60px_rgba(99,102,241,0.6)] flex items-center justify-center relative z-10"><Wind size={64} className="text-white opacity-80" /></motion.div>
            </div>
            <motion.p key={breathText} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`mt-12 text-4xl font-black tracking-wide ${darkMode ? 'text-indigo-200' : 'text-indigo-900'}`}>{breathText}</motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}