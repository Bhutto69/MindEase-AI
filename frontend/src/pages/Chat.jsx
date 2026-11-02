import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Square, Mic, Image, Paperclip, Sparkles, MoreVertical, AlertCircle } from 'lucide-react';
import { sendMessage, streamMessage, getHistory, getSessions, getSessionMessages, getReflection, cancelMessage } from '../services/api';

// Show the AI's **bold** and *italic* markdown as styled text instead of raw asterisks.
function renderInline(text) {
  return text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g).map((part, i) => {
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

const WELCOME_FIRST_TIME = {
  id: 1,
  role: 'assistant',
  content: "Hello! I'm here to listen. Would you like to share what's on your mind? 😊",
  subtext: "Everything you share here stays private and anonymous. 🌈",
  isWelcome: true,
};

const WELCOME_RETURNING = {
  id: 1,
  role: 'assistant',
  content: "Hey! What's on your mind today? 💙",
  isWelcome: true,
};

export default function Chat({ darkMode, showCrisis, setShowCrisis, sessionId, visitSession, isAdmin }) {
  const [messages, setMessages] = useState([WELCOME_FIRST_TIME]);
  const [hasPriorSessions, setHasPriorSessions] = useState(null); // null = not known yet
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const [showArchive, setShowArchive] = useState(false);
  const [showCrisisBanner, setShowCrisisBanner] = useState(false);
  const [reflection, setReflection] = useState(null);
  const [loadingReflection, setLoadingReflection] = useState(false);
  const inputRef = React.useRef(null);
  const abortRef = React.useRef(null);
  const lastSentRef = React.useRef('');
  const cancelledRef = React.useRef(false);
  const pendingMsgIdRef = React.useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Quietly load past history for the LLMs (NOT shown on screen)
  const [pastHistory, setPastHistory] = useState([]);

  // Load ALL prior sessions' messages into pastHistory (cross-session memory)
  useEffect(() => {
    if (!sessionId) return;
    getSessions(sessionId).then(async (data) => {
      const allSessions = data.sessions || [];
      setHasPriorSessions(allSessions.length > 0);

      const priorSessions = allSessions
        .filter((s) => s.session_id !== visitSession)
        .slice(-3);                                    // ← last 3 sessions only
      const historyArrays = await Promise.all(
        priorSessions.map((s) => getSessionMessages(sessionId, s.session_id))
      );
      const flattened = historyArrays
        .flatMap((d) => d.messages || [])
        .filter((m) => m.role !== 'system' && !m.content.startsWith('['))
        .map((m) => ({ role: m.role, content: m.content }));
      setPastHistory(flattened.slice(-40));            // ← cap carried context
    });
  }, [sessionId]);

  // Restore THIS visit's conversation when returning to the chat page (same login)
  useEffect(() => {
    if (!sessionId || !visitSession || hasPriorSessions === null) return;
    setShowCrisisBanner(false);
    getSessionMessages(sessionId, visitSession).then((data) => {
      const visible = (data.messages || []).filter(
        (m) => m.role !== 'system' && !m.content.startsWith('[')
      );
      setMessages(visible.length > 0
        ? visible.map((m, i) => ({ id: i + 1, role: m.role, content: m.content }))
        : [hasPriorSessions ? WELCOME_RETURNING : WELCOME_FIRST_TIME]
      );
    });
  }, [sessionId, visitSession, hasPriorSessions]);

  const [sessions, setSessions] = useState([]);
  useEffect(() => {
    if (showArchive && sessionId) {
      getSessions(sessionId).then((data) => setSessions(data.sessions || []));
    }
  }, [showArchive, sessionId]);

  React.useEffect(() => {
    if (!isTyping) inputRef.current?.focus();
  }, [isTyping]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;

    const userText = inputValue.trim();
    lastSentRef.current = userText;
    cancelledRef.current = false; // reset from any previous stop
    setInputValue('');
    setError(null);

    const msgId = Date.now();
    pendingMsgIdRef.current = msgId;
    setMessages((prev) => [...prev, { id: msgId, role: 'user', content: userText }]);
    setIsTyping(true);

    const history = [
      ...pastHistory,
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const replyId = msgId + 1;
      let started = false;

      setIsStreaming(true);
      await streamMessage(userText, history, sessionId, visitSession,
                          controller.signal, String(msgId), (evt) => {
        if (cancelledRef.current) return;

        if (evt.type === 'crisis') {
          setShowCrisisBanner(true);
        } else if (evt.type === 'token') {
          if (!started) {
            started = true;
            setIsTyping(false);
            setMessages((prev) => [...prev,
              { id: replyId, role: 'assistant', content: evt.data }]);
          } else {
            setMessages((prev) => prev.map((m) =>
              m.id === replyId ? { ...m, content: m.content + evt.data } : m));
          }
        } else if (evt.type === 'done') {
          if (evt.data.crisis) setShowCrisisBanner(true);
          const note = (isAdmin && evt.data.sources?.length)
            ? `📚 Sources: ${[...new Set(evt.data.sources.map((s) => s.source?.split(/[\\/]/).pop()).filter(Boolean))].join(', ')}`
            : null;
          setMessages((prev) => prev.map((m) =>
            m.id === replyId ? { ...m, content: evt.data.reply, subtext: note } : m));
        }
      });
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError('Could not reach MindEase server.');
    } finally {
      setIsStreaming(false);
      if (abortRef.current) {
        setIsStreaming(false);
        setIsTyping(false);
        abortRef.current = null;
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    }
  };

  const handleAttachment = (type) => {
    console.log(`Triggered: ${type}`);
  };

  const openReflection = async () => {
    setLoadingReflection(true);
    setReflection(null);
    const data = await getReflection(sessionId);
    setReflection(data.reflection || "You're here, and that matters. I'm with you. 💙");
    setLoadingReflection(false);
  };

  const handleStop = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    cancelledRef.current = true;
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setIsTyping(false);
    // Capture the id NOW — the setMessages updater runs later,
    // after the ref has already been cleared
    const idToRemove = pendingMsgIdRef.current;
    setMessages((prev) => prev.filter((m) => m.id !== idToRemove && m.id !== idToRemove + 1));
    pendingMsgIdRef.current = null;
    // Bring the text back into the input so the user can edit and resend
    setInputValue(lastSentRef.current);
    setTimeout(() => inputRef.current?.focus(), 0);
    // Tell the backend to forget this exact message too, so it doesn't
    // reappear when the chat reloads history
    if (idToRemove) cancelMessage(sessionId, visitSession, String(idToRemove)).catch(() => {});
  };

  return (
    <div
      className={`h-screen flex flex-col relative transition-colors duration-500 ${
        darkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* HEADER */}
      <header
        className={`p-6 border-b flex items-center justify-between transition-all ${
          darkMode
            ? 'bg-slate-900/50 border-slate-800 shadow-none'
            : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-2xl flex items-center justify-center text-2xl shadow-inner transform hover:rotate-12 transition-transform">
            🤖
          </div>
          <div>
            <h2
              className={`text-xl font-bold leading-tight ${
                darkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              MindEase Companion 👋
            </h2>
            <p className="text-xs text-green-600 flex items-center gap-2 font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Active Support | Ready to listen 👂
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openReflection}
            title="A moment for you ✨"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <Sparkles className="text-indigo-400 animate-pulse" size={20} />
          </button>
          <button
            onClick={() => setShowArchive(!showArchive)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
          >
            <MoreVertical size={20} />
          </button>
        </div>
      </header>

      {/* CRISIS HELP BANNER — slides down, does NOT interrupt the chat */}
      <AnimatePresence>
        {showCrisisBanner && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-red-50 border-b-2 border-red-200"
          >
            <div className="p-5 relative">
              <button
                onClick={() => setShowCrisisBanner(false)}
                className="absolute top-3 right-4 text-red-400 hover:text-red-600 font-bold"
              >
                ✕
              </button>
              <p className="font-black text-red-700 mb-2 flex items-center gap-2">
                <AlertCircle size={18} /> You are not alone — support is available right now
              </p>
              <div className="text-sm text-red-800 space-y-1">
                <p><span className="font-bold">Umang (24/7, free):</span> 0311-7786264</p>
                <p><span className="font-bold">National Youth Helpline:</span> 0800-69457</p>
                <p><span className="font-bold">Emergency (Pakistan):</span> 1122</p>
                <p>
                  More verified helplines:{' '}
                  <a href="https://findahelpline.com/countries/pk" target="_blank" rel="noopener noreferrer" className="underline font-bold">
                    findahelpline.com/pk
                  </a>
                </p>
              </div>
              <p className="text-xs text-red-500 mt-2 italic">I'm still here with you. We can keep talking.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* A MOMENT FOR YOU — gentle reflection */}
      <AnimatePresence>
        {(reflection || loadingReflection) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setReflection(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className={`max-w-md w-full rounded-[2rem] p-8 shadow-2xl text-center ${darkMode ? 'bg-slate-800' : 'bg-white'}`}
            >
              <div className="text-4xl mb-4">✨</div>
              <h3 className={`text-xl font-black mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>A moment for you</h3>
              {loadingReflection ? (
                <p className="text-slate-400 italic">Taking a moment...</p>
              ) : (
                <p className={`text-lg leading-relaxed font-medium ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                  {reflection}
                </p>
              )}
              <button
                onClick={() => setReflection(null)}
                className="mt-6 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors"
              >
                Thank you 💙
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ARCHIVE PANEL */}
      {showArchive && (
        <div className="absolute top-24 right-6 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-5 w-80 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-slate-900 dark:text-white">Past Chats</p>
            <button
              onClick={() => setShowArchive(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
            >
              ✕
            </button>
          </div>

          {sessions.length === 0 ? (
            <p className="text-sm text-slate-500">No past conversations yet.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <button
                  key={s.session_id}
                  onClick={async () => {
                    const data = await getSessionMessages(sessionId, s.session_id);
                    const loaded = (data.messages || []).map((m, i) => ({
                      id: i + 1, role: m.role, content: m.content,
                    }));
                    if (loaded.length > 0) setMessages(loaded);
                    setShowArchive(false);
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <p className="font-bold text-sm text-slate-900 dark:text-white">
                    {new Date(s.started + ' UTC').toLocaleString(undefined, {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </p>
                  <p className="text-xs text-slate-500">{s.count} messages</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MESSAGES AREA */}
      <div className="flex-1 p-8 overflow-y-auto space-y-6">
        {messages
          .filter((msg) => !(msg.isWelcome && messages.length > 1))
          .map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, scale: 0.9, x: msg.role === 'user' ? 20 : -20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            className={`max-w-xl p-6 rounded-3xl leading-relaxed border-2 transition-all ${
              msg.role === 'user'
                ? 'ml-auto bg-indigo-600 text-white border-transparent rounded-tr-none'
                : darkMode
                ? 'bg-slate-950 text-slate-200 border-slate-800 shadow-none rounded-tl-none'
                : 'bg-white text-slate-700 border-slate-300 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] rounded-tl-none'
            }`}
          >
            {msg.content && <p className="text-lg whitespace-pre-wrap">{msg.role === 'assistant' ? renderInline(msg.content) : msg.content}</p>}
            {msg.subtext && (
              <p
                className={`mt-3 text-sm opacity-70 italic ${
                  msg.role === 'user' ? 'text-indigo-100' : 'text-slate-500'
                }`}
              >
                {msg.subtext}
              </p>
            )}
          </motion.div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-1.5 p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75"></span>
            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150"></span>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-xl mx-auto p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm font-medium flex items-start gap-3"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA */}
      <div
        className={`p-6 border-t transition-all ${
          darkMode
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200 shadow-[0_-15px_30px_-5px_rgba(0,0,0,0.05)]'
        }`}
      >
        <form
          onSubmit={handleSendMessage}
          className="max-w-5xl mx-auto flex items-center gap-3"
        >
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isTyping || isStreaming}
            className={`flex-1 p-4 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all font-medium border-2 disabled:opacity-50 ${
              darkMode
                ? 'bg-slate-800 text-white border-transparent placeholder-slate-500'
                : 'bg-white text-slate-900 border-slate-400 shadow-xl shadow-slate-200/50 placeholder-slate-500'
            }`}
            placeholder="Share your thoughts anonymously... ✍️"
          />

          <motion.button
            type="button"
            onClick={(e) => ((isTyping || isStreaming) ? handleStop(e) : handleSendMessage(e))}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={!isTyping && !isStreaming && !inputValue.trim()}
            className={`text-white p-4 rounded-2xl shadow-xl transition-all flex items-center justify-center min-w-[56px] disabled:opacity-50 disabled:cursor-not-allowed ${(isTyping || isStreaming) ? 'bg-red-600 hover:bg-red-700 shadow-red-500/40' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/40'}`}
          >
            {(isTyping || isStreaming) ? <Square size={24} /> : <Send size={24} />}
          </motion.button>
        </form>

        <p className="text-[10px] text-center mt-4 text-slate-400 uppercase tracking-widest font-bold">
          MindEase AI: Encrypted &amp; Private Support for Your Mental Well-being 🔒
        </p>
      </div>
    </div>
  );
}