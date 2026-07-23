import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Shield, BookOpen, Sparkles } from 'lucide-react';

export default function AboutModal({ darkMode, onClose }) {
  const card = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const text = darkMode ? 'text-white' : 'text-slate-900';
  const sub = darkMode ? 'text-slate-300' : 'text-slate-600';

  const points = [
    { icon: <Heart size={18} className="text-rose-500" />, title: 'A companion, not a cure', desc: "MindEase is here to listen and help you feel less alone. It supports your wellbeing — it does not replace professional care." },
    { icon: <Shield size={18} className="text-indigo-500" />, title: 'Private & anonymous', desc: "You use an anonymous Session ID — no name, no email, no personal details required. Your space is yours." },
    { icon: <BookOpen size={18} className="text-emerald-500" />, title: 'Grounded in real guidance', desc: "Responses draw on trusted mental-health resources, so support is caring and informed." },
    { icon: <Sparkles size={18} className="text-amber-500" />, title: 'Built for students', desc: "Designed with students in mind — for the stress, pressure, and ups and downs of student life." },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-lg rounded-[2rem] p-8 shadow-2xl border ${card}`}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className={`text-2xl font-black ${text}`}>About MindEase 💙</h2>
            <button onClick={onClose} className={`p-2 rounded-full ${darkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
              <X size={22} />
            </button>
          </div>

          <p className={`mb-6 leading-relaxed font-medium ${sub}`}>
            MindEase AI is a warm, anonymous companion for students navigating depression, anxiety,
            and the weight of everyday life. It's built to make you feel heard — not judged.
          </p>

          <div className="space-y-4 mb-6">
            {points.map((p, i) => (
              <div key={i} className={`flex gap-3 p-4 rounded-2xl ${darkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
                <div className="mt-0.5">{p.icon}</div>
                <div>
                  <p className={`font-bold text-sm ${text}`}>{p.title}</p>
                  <p className={`text-sm ${sub}`}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <p className="text-xs text-amber-800 font-medium leading-relaxed">
              ⚠️ <span className="font-bold">Important:</span> MindEase is a supportive tool, not a substitute
              for professional diagnosis or treatment. If you're struggling, please reach out to a qualified
              professional or a helpline. You deserve real support.
            </p>
          </div>

          <p className={`text-center text-xs mt-6 font-bold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            MindEase AI · A Final Year Project
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}