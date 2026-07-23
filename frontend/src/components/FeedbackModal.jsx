import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Check } from 'lucide-react';
import { sendFeedback } from '../services/api';

export default function FeedbackModal({ darkMode, sessionId, onClose }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!rating) return;
    await sendFeedback(sessionId, rating, comment);
    setDone(true);
    setTimeout(onClose, 1500);
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" onClick={onClose}>
        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-md rounded-[2rem] p-8 shadow-2xl ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
          <div className="flex justify-between items-center mb-6">
            <h2 className={`text-2xl font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>Your Feedback 💬</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={22} /></button>
          </div>
          {done ? (
            <div className="text-center py-8">
              <Check size={48} className="mx-auto text-emerald-500 mb-3" />
              <p className={`font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Thank you! 💙</p>
            </div>
          ) : (
            <>
              <p className={`mb-4 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>How has MindEase been for you?</p>
              <div className="flex gap-2 justify-center mb-6">
                {[1,2,3,4,5].map((n) => (
                  <button key={n} onClick={() => setRating(n)}>
                    <Star size={36} className={n <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />
                  </button>
                ))}
              </div>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)}
                placeholder="Any thoughts? (optional)"
                className={`w-full h-24 p-4 rounded-xl outline-none border mb-4 text-sm ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`} />
              <button onClick={submit} disabled={!rating}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50">
                Submit Feedback
              </button>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}