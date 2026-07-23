import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, ShieldCheck, AlertCircle } from 'lucide-react';
import { setSecurity, changeNickname } from '../services/api';

export default function Profile({ sessionId, onDone }) {
  const [nickname, setNickname] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError('');
    if (!question.trim() || !answer.trim()) { setError('Please set a recovery question and answer.'); return; }
    setBusy(true);
    if (nickname.trim()) await changeNickname(sessionId, nickname.trim());
    const res = await setSecurity(sessionId, question.trim(), answer.trim());
    setBusy(false);
    if (res.ok) onDone(nickname.trim());
    else setError(res.error || 'Could not save. Try again.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full rounded-[2.5rem] p-10 border-2 bg-white border-slate-200 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-4">
            <ShieldCheck size={40} />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Complete your profile</h1>
          <p className="text-sm mt-2 text-slate-500">One quick step so you can recover your account later.</p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Nickname (optional)</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)}
                placeholder="What should we call you?"
                className="w-full p-4 pl-12 rounded-2xl outline-none border-2 bg-white border-slate-400 text-slate-900 placeholder-slate-300 shadow-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Recovery Question</label>
            <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)}
              placeholder="Write your own question"
              className="w-full p-4 rounded-2xl outline-none border-2 bg-white border-slate-400 text-slate-900 placeholder-slate-300 shadow-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Your Secret Answer</label>
            <input type="text" value={answer} onChange={(e) => setAnswer(e.target.value)}
              placeholder="Only you should know this"
              className="w-full p-4 rounded-2xl outline-none border-2 bg-white border-slate-400 text-slate-900 placeholder-slate-300 shadow-sm" />
            <p className="text-[11px] text-slate-400 mt-2 ml-1">💡 Pick something only you know. The answer can be anything — a word, phrase, or number series. Case doesn't matter.</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 font-medium">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
            </div>
          )}

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={save} disabled={busy}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
            <ShieldCheck size={20} /> {busy ? 'Saving...' : 'Save & Continue ✨'}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}