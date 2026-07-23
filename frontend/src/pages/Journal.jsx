import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PenTool, Save, X, Calendar, Book, Sparkles, AlertCircle } from 'lucide-react';
import { saveJournal, getJournal } from '../services/api';

export default function Journal({ darkMode, sessionId }) {
  const [isWriting, setIsWriting] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [entries, setEntries] = useState([]);
  const [saving, setSaving] = useState(false);
  const [crisis, setCrisis] = useState(false);

  // Load saved journal entries on open
  useEffect(() => {
    if (!sessionId) return;
    getJournal(sessionId).then((data) => setEntries(data.entries || []));
  }, [sessionId]);

  const fmtDate = (ts) => {
    try {
      return new Date(ts + ' UTC').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return ts;
    }
  };

  const handleSaveEntry = async () => {
    if (!noteContent.trim() || !sessionId) return;
    setSaving(true);
    const res = await saveJournal(sessionId, noteContent.trim());
    setSaving(false);
    if (res && res.ok) {
      if (res.crisis) setCrisis(true);
      setNoteContent("");
      setIsWriting(false);
      // reload entries so the new one shows with its saved timestamp
      getJournal(sessionId).then((data) => setEntries(data.entries || []));
    }
  };

  return (
    <div className={`p-8 min-h-screen transition-colors duration-500 ${darkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-950'}`}>

      {/* CRISIS HELP BANNER (gentle, if crisis language was written) */}
      <AnimatePresence>
        {crisis && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-red-50 border-2 border-red-200 rounded-2xl mb-6"
          >
            <div className="p-5 relative">
              <button onClick={() => setCrisis(false)} className="absolute top-3 right-4 text-red-400 hover:text-red-600 font-bold">✕</button>
              <p className="font-black text-red-700 mb-2 flex items-center gap-2">
                <AlertCircle size={18} /> You are not alone — support is available right now
              </p>
              <div className="text-sm text-red-800 space-y-1">
                <p><span className="font-bold">Umang (24/7, free):</span> 0311-7786264</p>
                <p><span className="font-bold">National Youth Helpline:</span> 0800-69457</p>
                <p><span className="font-bold">Emergency (Pakistan):</span> 1122</p>
                <p>More verified helplines: <a href="https://findahelpline.com/countries/pk" target="_blank" rel="noopener noreferrer" className="underline font-bold">findahelpline.com/pk</a></p>
              </div>
              <p className="text-xs text-red-500 mt-2 italic">Whatever you're carrying, you don't have to carry it alone.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className={`text-4xl font-black flex items-center gap-3 ${darkMode ? 'text-white' : 'text-slate-950'}`}>
            Guided Journal <Book className="text-indigo-500" size={32} />
          </h1>
          <p className={`mt-2 font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Your private space for thoughts, reflections, and growth. 🌿
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsWriting(true)}
          className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-bold shadow-xl shadow-indigo-500/30 flex items-center gap-2 hover:bg-indigo-700 transition-colors"
        >
          <PenTool size={20} /> New Reflection
        </motion.button>
      </header>

      {/* ENTRIES */}
      <div className="space-y-6">
        {entries.map((entry, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`p-8 rounded-[2rem] border-2 transition-all group ${
              darkMode
                ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/50'
                : 'bg-white border-slate-200 shadow-lg shadow-slate-200/50 hover:border-indigo-200'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-2 ${
                darkMode ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-50 text-indigo-600'
              }`}>
                <Calendar size={12} /> {fmtDate(entry.ts)}
              </span>
            </div>
            <p className={`text-lg leading-relaxed font-medium ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
              "{entry.content}"
            </p>
          </motion.div>
        ))}

        {entries.length === 0 && (
          <div className="text-center py-20 opacity-50">
            <Sparkles size={48} className="mx-auto mb-4 text-indigo-400" />
            <p className="text-xl font-bold">No entries yet. Start your journey today! ✨</p>
          </div>
        )}
      </div>

      {/* WRITE MODAL */}
      <AnimatePresence>
        {isWriting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={`w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl relative ${
                darkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-2xl font-black flex items-center gap-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  New Entry ✍️
                </h2>
                <button
                  onClick={() => setIsWriting(false)}
                  className={`p-2 rounded-full transition-colors ${darkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <X size={24} />
                </button>
              </div>

              <textarea
                autoFocus
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="What's on your mind today?..."
                className={`w-full h-64 p-6 rounded-3xl text-lg font-medium outline-none resize-none transition-all border-2 mb-6 ${
                  darkMode
                    ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-indigo-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-400'
                }`}
              />

              <div className="flex gap-4 justify-end">
                <button
                  onClick={() => setIsWriting(false)}
                  className={`px-6 py-3 rounded-xl font-bold transition-colors ${darkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSaveEntry}
                  disabled={!noteContent.trim() || saving}
                  className={`px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg ${
                    noteContent.trim() && !saving
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-500/25'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600'
                  }`}
                >
                  <Save size={18} /> {saving ? 'Saving...' : 'Save Entry'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}