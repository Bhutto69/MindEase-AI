import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Trash2, AlertTriangle, Check, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { changePassword, clearContent, deleteAccount, changeNickname, changeUserId, verifyAnswer, forgotQuestion, secureAction } from '../services/api';

export default function SettingsModal({ darkMode, sessionId, onClose, onLoggedOut, setSessionId, setNickname, isAdmin }) {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [msg, setMsg] = useState(null); // {type:'ok'|'err', text}
  const [confirm, setConfirm] = useState(null); // 'clear' | 'delete'
  const [busy, setBusy] = useState(false);
  const [showId, setShowId] = useState(false);
  const [nick, setNick] = useState('');
  const [newId, setNewId] = useState('');
  const [confirmNewId, setConfirmNewId] = useState(false);
  const [currentId, setCurrentId] = useState(sessionId);
  const [actionPw, setActionPw] = useState('');
  const [actionForgot, setActionForgot] = useState(false);
  const [actionQuestion, setActionQuestion] = useState('');
  const [actionAnswer, setActionAnswer] = useState('');
  const [clearMsg, setClearMsg] = useState('');

  const card = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const text = darkMode ? 'text-white' : 'text-slate-900';
  const sub = darkMode ? 'text-slate-400' : 'text-slate-500';

  const handleChangeId = async () => {
    if (!newId.trim()) return;
    const res = await changeUserId(sessionId, newId.trim());
    if (res.ok) {
      if (setSessionId) setSessionId(newId.trim());
      setMsg({ type: 'ok', text: 'User ID changed successfully! ' });
      setNewId('');
    } else {
      setMsg({ type: 'err', text: res.error || 'Could not change ID.' });
    }
  };

  const handleChangePw = async () => {
    setMsg(null);
    if (!oldPw || !newPw) { setMsg({ type: 'err', text: 'Fill in both password fields.' }); return; }
    setBusy(true);
    const res = await changePassword(currentId, oldPw, newPw);
    setBusy(false);
    if (res.ok) {
      setMsg({ type: 'ok', text: 'Password changed successfully.' });
      setOldPw(''); setNewPw('');
    } else {
      setMsg({ type: 'err', text: res.error || 'Could not change password.' });
    }
  };

  const resetActionState = () => { setActionPw(''); setActionForgot(false); setActionQuestion(''); setActionAnswer(''); setConfirm(null); };

  const handleClear = async () => {
    setBusy(true);
    const res = await clearContent(currentId, actionPw);
    setBusy(false);
    if (res?.ok) {
      setClearMsg('Your chats and journals have been cleared.');
      resetActionState();
    } else {
      setMsg({ type: 'err', text: res?.error || 'Password is incorrect.' });
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    const res = await deleteAccount(currentId, actionPw);
    setBusy(false);
    if (res?.ok) { onLoggedOut(); }
    else { setMsg({ type: 'err', text: res?.error || 'Password is incorrect.' }); }
  };

  const openForgot = async () => {
    setMsg(null);
    const res = await forgotQuestion(currentId);
    if (res.ok) { setActionQuestion(res.question); setActionForgot(true); }
    else { setMsg({ type: 'err', text: res.error || 'No recovery question set.' }); }
  };

  const verifyAndRun = async () => {
    setBusy(true);
    const res = await secureAction(currentId, actionAnswer, confirm); // confirm = 'clear' | 'delete'
    setBusy(false);
    if (!res.ok) { setMsg({ type: 'err', text: res.error || 'Incorrect answer.' }); return; }
   if (confirm === 'clear') { setClearMsg('Your chats and journals have been cleared.'); resetActionState(); }
    else if (confirm === 'delete') { onLoggedOut(); }
  };

  const doNewId = async () => {
    const genId = `ME-${Math.floor(1000 + Math.random() * 9000)}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    const res = await changeUserId(currentId, genId);
    if (res.ok) {
      if (setSessionId) setSessionId(genId);
      setCurrentId(genId);
      setMsg({ type: 'ok', text: 'New ID assigned!  Save it now.' });
    } else {
      setMsg({ type: 'err', text: 'Could not change ID, try again.' });
    }
    setConfirmNewId(false);
  };

  const handleNick = async () => {
    if (!nick.trim()) return;
    await changeNickname(currentId, nick.trim());
    if (setNickname) setNickname(nick.trim());
    setMsg({ type: 'ok', text: 'Nickname updated! ' });
    setNick('');
  };

const handleAdminId = async () => {
    if (!newId.trim()) return;
    const res = await changeUserId(currentId, newId.trim());
    if (res.ok) {
      if (setSessionId) setSessionId(newId.trim());
      setCurrentId(newId.trim());
      setMsg({ type: 'ok', text: 'ID changed! Log in with the new ID next time.' });
      setNewId('');
    } else {
      setMsg({ type: 'err', text: res.error || 'That ID is taken.' });
    }
  };

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
            <h2 className={`text-2xl font-black ${text}`}>Settings ⚙️</h2>
            <button onClick={onClose} className={`p-2 rounded-full ${darkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
              <X size={22} />
            </button>
          </div>

          {/* Your Session ID — so you never lose it */}
          <div className={`p-5 rounded-2xl border mb-4 ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
            <p className={`font-bold mb-1 text-sm ${text}`}>Your Session ID 🔑 (admin: {String(isAdmin)})</p>
            <p className={`text-xs mb-3 ${sub}`}>Save this — you need it (with your password) to log back in.</p>
            <div className="flex items-center gap-2">
              {isAdmin ? (
                <input
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  placeholder={currentId}
                  className={`flex-1 px-4 py-3 rounded-xl font-mono font-bold text-sm outline-none border ${darkMode ? 'bg-slate-800 text-indigo-300 border-slate-700' : 'bg-white text-indigo-600 border-slate-200'}`}
                />
              ) : (
                <code className={`flex-1 px-4 py-3 rounded-xl font-mono font-bold text-sm break-all ${darkMode ? 'bg-slate-800 text-indigo-300' : 'bg-white text-indigo-600 border border-slate-200'}`}>
                  {showId ? currentId : '•'.repeat((currentId || '').length || 12)}
                </code>
              )}
              <button
                onClick={() => setShowId(!showId)}
                title={showId ? 'Hide' : 'Show'}
                className={`px-3 py-3 rounded-xl transition-colors ${darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}
              >
                {showId ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              {!isAdmin && (
                <button
                  onClick={() => setConfirmNewId(true)}
                  title="Get a new ID"
                  className={`px-3 py-3 rounded-xl transition-colors ${darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                >
                  <RefreshCw size={18} />
                </button>
              )}
              {isAdmin ? (
                <button onClick={handleAdminId}
                  className="px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors">
                  Set
                </button>
              ) : (
                <button
                  onClick={() => { navigator.clipboard.writeText(currentId); setMsg({ type: 'ok', text: 'Session ID copied!' }); }}
                  className="px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors">
                  Copy
                </button>
              )}
            </div>
            {confirmNewId && (
            <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-800 font-bold mb-2">Get a new ID? Your data stays, but you must save the new ID to log in again.</p>
              <div className="flex gap-2">
                <button onClick={doNewId} className="flex-1 py-2 bg-amber-500 text-white rounded-lg font-bold text-sm hover:bg-amber-600">Yes, new ID</button>
                <button onClick={() => setConfirmNewId(false)} className="px-4 py-2 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
              </div>
            </div>
          )}
          </div>

          
          <div className={`p-5 rounded-2xl border mb-4 ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
            <p className={`font-bold mb-3 ${text}`}>Change Nickname</p>
            <div className="flex gap-2">
              <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="New nickname"
                className={`flex-1 p-3 rounded-xl outline-none border text-sm ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`} />
              <button onClick={handleNick} className="px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700">Save</button>
            </div>
          </div>
          {msg && (
            <div className={`mb-5 p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
              msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {msg.type === 'ok' ? <Check size={16} /> : <AlertTriangle size={16} />} {msg.text}
            </div>
          )}

          {/* CHANGE PASSWORD */}
          <div className={`p-5 rounded-2xl border mb-4 ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
            <p className={`font-bold mb-3 flex items-center gap-2 ${text}`}><Lock size={16} /> Change Password</p>
            <input
              type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)}
              placeholder="Current password"
              className={`w-full p-3 rounded-xl outline-none border mb-3 text-sm ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
            />
            <input
              type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
              placeholder="New password"
              className={`w-full p-3 rounded-xl outline-none border mb-3 text-sm ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
            />
            <button onClick={handleChangePw} disabled={busy}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-60">
              Update Password
            </button>
          </div>
          

          {/* CLEAR CONTENT */}
          {!isAdmin && (
          <div className={`p-5 rounded-2xl border mb-4 ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
            <p className={`text-xs mb-3 ${sub}`}>Erases all your conversations and journal entries. Your account stays.</p>
            {clearMsg && <p className="text-xs mb-3 font-bold text-emerald-600">✓ {clearMsg}</p>}
            {confirm === 'clear' ? (
              <div className="space-y-2">
                {!actionForgot ? (
                  <>
                    <input type="password" value={actionPw} onChange={(e) => setActionPw(e.target.value)}
                      placeholder="Enter your password to confirm"
                      className={`w-full p-2.5 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300'}`} />
                    <div className="flex gap-2">
                      <button onClick={handleClear} disabled={busy || !actionPw} className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 disabled:opacity-60">Confirm clear</button>
                      <button onClick={resetActionState} className={`px-4 py-2.5 rounded-xl font-bold text-sm ${darkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'}`}>Cancel</button>
                    </div>
                    <button onClick={openForgot} className="text-xs font-bold text-indigo-500 hover:text-indigo-600">Forgot password?</button>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-bold">{actionQuestion}</p>
                    <input type="text" value={actionAnswer} onChange={(e) => setActionAnswer(e.target.value)}
                      placeholder="Your answer"
                      className={`w-full p-2.5 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300'}`} />
                    <div className="flex gap-2">
                      <button onClick={verifyAndRun} disabled={busy || !actionAnswer} className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 disabled:opacity-60">Verify & clear</button>
                      <button onClick={resetActionState} className={`px-4 py-2.5 rounded-xl font-bold text-sm ${darkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'}`}>Cancel</button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button onClick={() => { setMsg(null); resetActionState(); setConfirm('clear'); }}
                className="w-full py-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl font-bold text-sm hover:bg-amber-100 transition-colors">
                Clear my chats &amp; journals
              </button>
            )}
          </div>
          )}


          {/* DELETE ACCOUNT */}
          {!isAdmin && (
          <div className="p-5 rounded-2xl border border-red-200 bg-red-50/50">
            <p className="font-bold mb-1 text-red-700 flex items-center gap-2"><Trash2 size={16} /> Delete Profile Forever</p>
            <p className="text-xs mb-3 text-red-500">Permanently deletes your account and everything in it. This cannot be undone.</p>
            {confirm === 'delete' ? (
              <div className="space-y-2">
                {!actionForgot ? (
                  <>
                    <input type="password" value={actionPw} onChange={(e) => setActionPw(e.target.value)}
                      placeholder="Enter your password to confirm"
                      className={`w-full p-2.5 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300'}`} />
                    <div className="flex gap-2">
                      <button onClick={handleDelete} disabled={busy || !actionPw} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 disabled:opacity-60">Confirm delete</button>
                      <button onClick={resetActionState} className="px-4 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
                    </div>
                    <button onClick={openForgot} className="text-xs font-bold text-indigo-500 hover:text-indigo-600">Forgot password?</button>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-bold">{actionQuestion}</p>
                    <input type="text" value={actionAnswer} onChange={(e) => setActionAnswer(e.target.value)}
                      placeholder="Your answer"
                      className={`w-full p-2.5 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300'}`} />
                    <div className="flex gap-2">
                      <button onClick={verifyAndRun} disabled={busy || !actionAnswer} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 disabled:opacity-60">Verify &amp; delete</button>
                      <button onClick={resetActionState} className="px-4 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button onClick={() => { setMsg(null); resetActionState(); setConfirm('delete'); }}
                className="w-full py-2.5 bg-white text-red-600 border border-red-300 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors">
                Delete my profile forever
              </button>
            )}
          </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}