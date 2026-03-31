import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Game from './components/Game';
import Login from './components/Login';
import AdminPanel from './components/AdminPanel';

export default function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-emerald-500 font-mono animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/admin/login" element={user ? <Navigate to="/admin" /> : <Login />} />
        <Route path="/" element={user ? <Game /> : <Navigate to="/login" />} />
        <Route path="/admin" element={user ? <AdminPanel /> : <Navigate to="/admin/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
