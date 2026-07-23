import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { logCrisisEvent } from './services/api';
import Profile from './pages/Profile';

import Navbar from './components/Navbar';
import Chat from './pages/Chat';
import Dashboard from './pages/Dashboard';
import Journal from './pages/Journal';
import Resources from './pages/Resources';
import Login from './pages/Login';
import Admin from './pages/Admin';
import CrisisModal from './components/CrisisModal';
import { createTestUser, endSession } from './services/api';
import Report from './pages/Report';

function AppContent() {
  const [darkMode, setDarkMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [nickname, setNickname] = useState("");
  const [visitSession, setVisitSession] = useState(null);
  const [showCrisis, setShowCrisis] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminId, setAdminId] = useState(null);
  const [adminNickname, setAdminNickname] = useState("");

  const location = useLocation();
  const navigate = useNavigate();

  const toggleDarkMode = () => setDarkMode(!darkMode);
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleLogin = (id, nick = "", admin = false, needsProfile = false) => {
  setSessionId(id); setNickname(nick); setIsAuthenticated(true);
  if (admin) {
    setIsAdmin(true);
    setAdminId(id);
    setAdminNickname(nick || id);
    navigate('/admin');
    return;
  }
  setVisitSession(`sess-${Date.now()}`);
  if (needsProfile) { navigate('/profile'); return; }
  navigate('/chat');
};

const handleNewChat = () => {
  if (sessionId && visitSession) endSession(sessionId, visitSession);
  setVisitSession(`sess-${Date.now()}`);
  navigate('/chat');
};

const [testUser, setTestUser] = useState(null);

  const handleEndSession = async () => {
    // Always summarise the conversation that's ending.
    if (sessionId && visitSession) {
      try { await endSession(sessionId, visitSession); } catch {}
    }

    // Admin: just start a fresh session, stay logged in for testing.
    if (isAdmin) {
      setVisitSession(`sess-${Date.now()}`);
      navigate('/chat');
      return;
    }

    // User: end the session and sign out.
    setVisitSession(null);
    setSessionId(null);
    setNickname("");
    setTestUser(null);
    setIsAuthenticated(false);
    navigate('/login');
  };

  const handleNewTestUser = async () => {
    const prev = testUser?.user_id || null;
    const d = await createTestUser(prev);
    if (!d.ok) return;
    setTestUser(d);
    setSessionId(d.user_id);
    setNickname(d.nickname);
    setVisitSession(`sess-${Date.now()}`);
    navigate('/chat');
  };

  return (
    <div className={`flex min-h-screen w-full transition-colors duration-500 ${darkMode ? 'dark bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {isAuthenticated && (
        <Navbar 
        darkMode={darkMode} 
        toggleDarkMode={toggleDarkMode} 
        isOpen={isSidebarOpen} 
        toggleSidebar={toggleSidebar} 
        setIsAuthenticated={setIsAuthenticated}
        onCrisisClick={() => { setShowCrisis(true); logCrisisEvent(sessionId, visitSession); }}
        onNewChat={handleNewChat}
        nickname={location.pathname.startsWith('/admin') ? adminNickname : nickname}
        setNickname={setNickname}
        sessionId={sessionId}
        isAdmin={isAdmin}
        onEndSession={handleEndSession}
        onNewTestUser={handleNewTestUser}
        testUser={testUser}
/>
      )}
      
      <main className={`flex-1 transition-all duration-300 ${isAuthenticated && isSidebarOpen ? 'ml-64' : isAuthenticated ? 'ml-20' : 'ml-0'}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Routes location={location}>
              <Route path="/login" element={<Login onLogin={handleLogin} />} />
              
              {isAuthenticated ? (
                <>
                  <Route path="/chat" element={
                    <Chat 
                      darkMode={darkMode} 
                      showCrisis={showCrisis} 
                      setShowCrisis={setShowCrisis}
                      sessionId={sessionId}
                      visitSession={visitSession}
                      isAdmin={isAdmin}
                    />
                  } />
                  <Route path="/dashboard" element={<Dashboard darkMode={darkMode} sessionId={sessionId} isAdmin={isAdmin} />} />
                  <Route path="/journal" element={<Journal darkMode={darkMode} sessionId={sessionId} />} />
                  <Route path="/resources" element={<Resources darkMode={darkMode} sessionId={sessionId} />} />
                  <Route path="*" element={<Navigate to="/chat" />} />
                  <Route path="/admin" element={<Admin darkMode={darkMode} sessionId={adminId || sessionId} />} />
                  <Route path="/report" element={<Report darkMode={darkMode} sessionId={sessionId} />} />
                  <Route path="/profile" element={
                    <Profile sessionId={sessionId} onDone={(nick) => { if (nick) setNickname(nick); navigate('/chat'); }} />
                  } />
                </>
              ) : (
                <Route path="*" element={<Navigate to="/login" />} />
              )}
            </Routes>
          </motion.div>
        </AnimatePresence>
        <CrisisModal show={showCrisis} onClose={() => setShowCrisis(false)} />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}