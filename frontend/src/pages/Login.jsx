import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Lock, Fingerprint, Copy, Check, RefreshCw, Moon, Sun, User, AlertCircle } from 'lucide-react';
import { registerUser, loginUser, forgotQuestion, forgotReset } from '../services/api';

export default function Login({ onLogin }) {
  const [isNewUser, setIsNewUser] = useState(true);
  const [generatedId, setGeneratedId] = useState('');
  const [enteredId, setEnteredId] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [copied, setCopied] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [forgot, setForgot] = useState(false);
  const [fgQuestion, setFgQuestion] = useState('');
  const [fgAnswer, setFgAnswer] = useState('');
  const [fgNewPw, setFgNewPw] = useState('');

  const generateNewId = () => {
    const randomId = `ME-${Math.floor(1000 + Math.random() * 9000)}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    setGeneratedId(randomId);
  };

  useEffect(() => {
    setError('');
    setForgot(false);
    if (isNewUser) { generateNewId(); setEnteredId(''); }
    else { setEnteredId(''); }
  }, [isNewUser]);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    setError('');
    setBusy(true);

    if (isNewUser) {
      const id = generatedId.trim();
      const res = await registerUser(id, password.trim());
      setBusy(false);
      if (res.ok) {
        onLogin(id, '', false, true);   // needsProfile = true
      } else {
        setError(res.error || 'Invalid Session ID or password.');
      }
    } else {
      const id = enteredId.trim();
      if (!id) { setBusy(false); setError('Please enter your Session ID.'); return; }

      const res = await loginUser(id, password.trim());
      setBusy(false);
      if (res.ok) {
        onLogin(id, res.nickname || '', res.is_admin || false, res.needs_profile || false);
      } else {
        setError(res.error || 'Invalid Session ID or password.');
      }
    }
  };

  const loadQuestion = async () => {
    setError('');
    const id = enteredId.trim();
    if (!id) { setError('Enter your Session ID first.'); return; }
    const res = await forgotQuestion(id);
    if (res.ok) { setFgQuestion(res.question); setForgot(true); }
    else setError(res.error || 'No recovery found for this ID.');
  };

  const doReset = async () => {
    setError('');
    const res = await forgotReset(enteredId.trim(), fgAnswer.trim(), fgNewPw.trim());
    if (res.ok) { setForgot(false); setFgAnswer(''); setFgNewPw(''); setError('Password reset! Log in with your new password.'); }
    else setError(res.error || 'Could not reset.');
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 transition-colors duration-500 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <button
        type="button"
        onClick={() => setIsDark(!isDark)}
        className={`fixed top-10 right-10 p-4 rounded-2xl shadow-xl z-50 transition-all ${isDark ? 'bg-slate-800 text-yellow-400 border border-slate-700' : 'bg-white text-slate-800 border border-slate-200'}`}
      >
        {isDark ? <Sun size={24} /> : <Moon size={24} />}
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`max-w-md w-full rounded-[2.5rem] p-10 border-2 transition-all ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-2xl shadow-slate-200'
        }`}
      >
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-4 shadow-xl shadow-indigo-500/20">
            <Fingerprint size={40} />
          </div>
          <h1 className={`text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            MindEase <span className="text-indigo-600">AI</span>
          </h1>
          <p className={`text-sm mt-2 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Your personal, anonymous mental health companion.
          </p>
        </div>

        <div className={`mb-8 p-5 rounded-2xl border-2 ${isDark ? 'bg-amber-950/30 border-amber-900/50' : 'bg-amber-50 border-amber-200'}`}>
          <p className={`text-sm font-bold mb-2 ${isDark ? 'text-amber-200' : 'text-amber-900'}`}>
            A final-year student project — not a clinical or emergency service.
          </p>
          <p className={`text-sm leading-relaxed ${isDark ? 'text-amber-300/80' : 'text-amber-800'}`}>
            MindEase is a research prototype and cannot replace professional help.
            If you're struggling right now, please reach out:
          </p>
          <p className={`text-sm font-bold mt-2 leading-relaxed ${isDark ? 'text-amber-200' : 'text-amber-900'}`}>
            Umang (24/7, free): 0311-7786264<br />
            Emergency (Pakistan): 1122
          </p>
        </div>

        <div className={`flex p-1 rounded-2xl mb-8 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
          <button type="button" onClick={() => setIsNewUser(true)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${isNewUser ? (isDark ? 'bg-slate-700 text-indigo-400 shadow-inner' : 'bg-white text-indigo-600 shadow-sm') : 'text-slate-500'}`}>
            New Identity
          </button>
          <button type="button" onClick={() => setIsNewUser(false)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${!isNewUser ? (isDark ? 'bg-slate-700 text-indigo-400 shadow-inner' : 'bg-white text-indigo-600 shadow-sm') : 'text-slate-500'}`}>
            Returning User
          </button>
        </div>

        <div className="space-y-5">
          {/* Session ID */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
              {isNewUser ? "Your New Session ID" : "Enter Your Session ID"}
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={isNewUser ? generatedId : enteredId}
                onChange={(e) => setEnteredId(e.target.value)}
                readOnly={isNewUser}
                placeholder={!isNewUser ? "e.g., ME-1234-ABCD" : ""}
                className={`w-full p-4 rounded-2xl font-mono font-bold outline-none border-2 transition-all ${
                  isNewUser
                    ? (isDark ? 'bg-slate-800 border-slate-700 text-indigo-400 shadow-inner' : 'bg-slate-50 border-slate-200 text-indigo-600')
                    : (isDark ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-600' : 'bg-white border-slate-400 text-slate-900 placeholder-slate-300 focus:ring-4 focus:ring-indigo-100')
                }`}
              />
              {isNewUser && (
                <div className="absolute right-3 flex gap-1">
                  <button type="button" onClick={generateNewId} className="p-2 text-slate-400 hover:text-indigo-400"><RefreshCw size={18} /></button>
                  <button type="button" onClick={handleCopy} className="p-2 text-slate-400 hover:text-indigo-400">{copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}</button>
                </div>
              )}
            </div>
            {isNewUser && (
              <p className="text-[11px] text-slate-400 mt-2 ml-1 font-medium">
                💡 Save this ID — you'll need it (with your password) to log back in.
              </p>
            )}
          </div>

          {/* Password — hidden while resetting */}
          {!forgot && (
          <div>
            <label className={`block text-xs font-bold uppercase tracking-widest mb-2 ml-1 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>Personal Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                placeholder="••••••••"
                className={`w-full p-4 pl-12 rounded-2xl outline-none border-2 transition-all ${
                  isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-400 text-slate-900 shadow-sm'
                }`}
              />
            </div>
          </div>
          )}

          {/* Forgot password — returning users */}
          {!isNewUser && !forgot && (
            <button type="button" onClick={loadQuestion}
              className="text-xs font-bold text-indigo-500 hover:text-indigo-600 ml-1">
              Forgot my password?
            </button>
          )}
          {!isNewUser && forgot && (
            <div className={`p-4 rounded-2xl border-2 space-y-3 ${isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-slate-50'}`}>
              <p className="text-sm font-bold">{fgQuestion}</p>
              <input type="text" value={fgAnswer} onChange={(e) => setFgAnswer(e.target.value)} placeholder="Your answer"
                className={`w-full p-3 rounded-xl outline-none border-2 text-sm ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`} />
              <input type="password" value={fgNewPw} onChange={(e) => setFgNewPw(e.target.value)} placeholder="New password"
                className={`w-full p-3 rounded-xl outline-none border-2 text-sm ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`} />
              <div className="flex gap-2">
                <button type="button" onClick={doReset} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700">Reset Password</button>
                <button type="button" onClick={() => setForgot(false)} className="px-4 py-2 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-100">Cancel</button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 font-medium">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
            </div>
          )}

          {/* Main button — hidden while resetting */}
          {!forgot && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={busy}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <ShieldCheck size={20} />
            {busy ? 'Please wait...' : (isNewUser ? "Create My Space ✨" : "Access My Space 🔑")}
          </motion.button>
          )}
        </div>

        <p className="mt-8 text-[10px] text-center text-slate-400 uppercase tracking-widest font-bold leading-relaxed">
          MindEase AI: Anonymous & Private 🔒<br/>
          Not a replacement for professional care
        </p>
      </motion.div>
    </div>
  );
}