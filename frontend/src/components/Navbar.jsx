import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, BarChart3, BookOpen, Library, AlertCircle, Moon, Sun, ChevronLeft, ChevronRight, LogOut, User, Settings, HelpCircle, Info, Plus, Dumbbell, NotebookPen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SettingsModal from './SettingsModal';
import AboutModal from './AboutModal';
import FeedbackModal from './FeedbackModal';

export default function Navbar({ darkMode, toggleDarkMode, isOpen, toggleSidebar, setIsAuthenticated, onCrisisClick, onNewChat, nickname, sessionId, isAdmin, setSessionId, setNickname, onEndSession, onNewTestUser, testUser }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

 const userItems = [
    { icon: <MessageCircle size={20}/>, label: 'AI Chat 💬', path: '/chat' },
    { icon: <BarChart3 size={20}/>, label: 'Analytics 📊', path: '/dashboard' },
    { icon: <NotebookPen size={20}/>, label: 'Mind Dump 🧠', path: '/journal' },
    { icon: <Dumbbell size={20}/>, label: 'Mind Gym 💪', path: '/resources' },
  ];

  // Admins get the real user nav plus a way back into the panel.
  const navItems = isAdmin
    ? [{ icon: <BarChart3 size={20}/>, label: 'Admin Panel 🛡️', path: '/admin' }, ...userItems]
    : userItems;

  const handleLogout = () => {
    setShowProfile(false);
    setIsAuthenticated(false);
    navigate('/login');
  };

  const profileItems = [
    { icon: <Settings size={16}/>, label: 'Settings', action: () => { console.log('SETTINGS CLICKED'); setShowSettings(true); } },
    { icon: <HelpCircle size={16}/>, label: 'Get Help', action: onCrisisClick },
    { icon: <Info size={16}/>, label: 'About Us', action: () => setShowAbout(true) },
    { icon: <Info size={16}/>, label: 'Give Feedback', action: () => setShowFeedback(true) },
  ];

  return (
    <nav className={`${isOpen ? 'w-64' : 'w-20'} h-screen fixed left-0 top-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 transition-all duration-300 z-50 flex flex-col p-4`}>
      <button onClick={toggleSidebar} className="absolute -right-3 top-10 bg-indigo-600 text-white rounded-full p-1 shadow-lg z-[60]">
        {isOpen ? <ChevronLeft size={16}/> : <ChevronRight size={16}/>}
      </button>

      {}
      {/* LOGO + moon toggle */}
      <div className="flex items-center justify-between mb-10 px-2 mt-2">
        <div className="flex items-center gap-3">
          <div className="min-w-[40px] h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold">✨</div>
          {isOpen && <h1 className="text-xl font-bold tracking-tight dark:text-white truncate">MindEase AI</h1>}
        </div>
        {isOpen && (
          <button
            onClick={toggleDarkMode}
            title={darkMode ? 'Light mode' : 'Dark mode'}
            className={`p-2 rounded-full transition-all ${darkMode ? 'text-yellow-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-200'}`}
          >
            {darkMode ? <Sun size={18}/> : <Moon size={18}/>}
          </button>
        )}
      </div>

      {}
      {/* NAV ITEMS */}
      <div className="flex-1 space-y-2">
        {!isAdmin && (
          <button
            onClick={onNewChat}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 active:bg-indigo-600 active:text-white active:scale-95"
          >
            <Plus size={20}/> {isOpen && <span className="font-medium">New Chat</span>}
          </button>
        )}
        {navItems.map((item) => (
          <Link key={item.path} to={item.path}
            className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${location.pathname === item.path ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
            {item.icon} {isOpen && <span className="font-medium">{item.label}</span>}
          </Link>
        ))}
      </div>

      {}
      {/* BOTTOM: Crisis + collapsed moon + Profile */}
      <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3 relative">

        {isAdmin ? (
          <div className="space-y-2">
            <button
              onClick={onEndSession}
              className="w-full flex items-center gap-2 justify-center p-3 rounded-2xl bg-slate-700 text-white hover:bg-slate-600 transition"
            >
              <Plus size={18}/> {isOpen && <span className="font-bold text-xs">END SESSION</span>}
            </button>
            <button
              onClick={onNewTestUser}
              className="w-full flex items-center gap-2 justify-center p-3 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-500 transition"
            >
              <User size={18}/> {isOpen && <span className="font-bold text-xs">NEW USER</span>}
            </button>
            {isOpen && testUser && (
              <div className="px-2 pt-1 text-[10px] leading-tight text-slate-400 font-mono break-all">
                <p>{testUser.user_id}</p>
                <p>{testUser.password}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={onEndSession}
              className="w-full flex items-center gap-2 justify-center p-3 rounded-2xl bg-slate-700 text-white hover:bg-slate-600 transition"
            >
              <Plus size={18}/> {isOpen && <span className="font-bold text-xs">END SESSION</span>}
            </button>
            <button
              onClick={onCrisisClick}
              className="w-full flex items-center gap-2 justify-center p-3 rounded-2xl bg-rose-600 text-white hover:bg-rose-500 transition"
            >
              <AlertCircle size={18}/> {isOpen && <span className="font-bold text-xs">CRISIS ALERT 🚨</span>}
            </button>
          </div>
        )}

        {!isOpen && (
          <button
            onClick={toggleDarkMode}
            title={darkMode ? 'Light mode' : 'Dark mode'}
            className={`w-full flex items-center justify-center py-3 rounded-xl ${darkMode ? 'text-yellow-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-200'}`}
          >
            {darkMode ? <Sun size={18}/> : <Moon size={18}/>}
          </button>
        )}

        {/* Profile popup */}
        <AnimatePresence>
          {showProfile && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={`absolute bottom-16 left-0 w-full rounded-2xl shadow-2xl border p-2 z-[70] ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
            >
              {profileItems.map((p) => (
                <button
                  key={p.label}
                  onClick={() => { p.action(); setShowProfile(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${darkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100'}`}
                >
                  {p.icon} {p.label}
                </button>
              ))}
              <div className={`my-1 border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}></div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut size={16}/> Logout
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Profile button */}
        <button
          onClick={() => setShowProfile(!showProfile)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${showProfile ? 'bg-indigo-600 text-white' : darkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-200'}`}
        >
          <div className="min-w-[32px] h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
            <User size={16} className="text-indigo-600 dark:text-indigo-300"/>
          </div>
          {isOpen && <span className="font-bold text-sm truncate">{nickname || 'Profile'}</span>}
        </button>
      </div>

      {}
      {showSettings && (
        <SettingsModal
          darkMode={darkMode}
          sessionId={sessionId}
          setSessionId={setSessionId}
          setNickname={setNickname}
          isAdmin={isAdmin}
          onClose={() => setShowSettings(false)}
          onLoggedOut={() => { setShowSettings(false); handleLogout(); }}
        />
      )}

      {showAbout && (
        <AboutModal darkMode={darkMode} onClose={() => setShowAbout(false)} />
      )}
      {showFeedback && (
        <FeedbackModal darkMode={darkMode} sessionId={sessionId} onClose={() => setShowFeedback(false)} />
      )}
    </nav>
  );
}