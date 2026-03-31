import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { loginWithGoogle, loginWithEmail } from '../firebase';
import { LogIn, ShieldAlert, Shield, Mail, Lock } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminLogin = location.pathname === '/admin/login';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      await loginWithGoogle();
      navigate(isAdminLogin ? '/admin' : '/');
    } catch (error) {
      setError('Google login failed. Please try again.');
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    
    // Special admin account check
    let loginEmail = email;
    if (isAdminLogin && email === 'lekimlam' && password === 'thanhthaocute') {
      loginEmail = 'lekimlam@admin.com'; // Map to a valid email format for Firebase
    }

    try {
      setLoading(true);
      setError('');
      await loginWithEmail(loginEmail, password);
      navigate(isAdminLogin ? '/admin' : '/');
    } catch (error: any) {
      console.error(error);
      setError(error.message || 'Login failed. Please check your credentials.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-800 border border-gray-700 p-6 sm:p-8 rounded-2xl shadow-2xl w-full max-w-md text-center relative overflow-hidden"
      >
        {isAdminLogin && (
          <div className="absolute top-0 left-0 w-full h-1 bg-purple-500"></div>
        )}
        <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isAdminLogin ? 'bg-purple-500/20 text-purple-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
          {isAdminLogin ? <Shield size={32} className="sm:w-10 sm:h-10" /> : <ShieldAlert size={32} className="sm:w-10 sm:h-10" />}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{isAdminLogin ? 'ADMIN PORTAL' : 'SNAKE.IO'}</h1>
        <p className="text-gray-400 mb-6 sm:mb-8 text-sm sm:text-base">{isAdminLogin ? 'Authorized Personnel Only' : 'Secure Login Required'}</p>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-gray-500" />
            </div>
            <input
              type={isAdminLogin && email === 'lekimlam' ? 'text' : 'email'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-gray-700 rounded-xl leading-5 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:text-sm transition-colors"
              placeholder={isAdminLogin ? "Admin Username or Email" : "Email address"}
            />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-500" />
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-gray-700 rounded-xl leading-5 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:text-sm transition-colors"
              placeholder="Password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white ${isAdminLogin ? 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500' : 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors disabled:opacity-50`}
          >
            {loading ? 'Signing in...' : (isAdminLogin ? 'Access Admin Panel' : 'Sign In / Register')}
          </button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-800 text-gray-400">Or continue with</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white text-gray-900 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          Google
        </button>
      </motion.div>

      <div className="mt-8">
        {isAdminLogin ? (
          <button onClick={() => navigate('/login')} className="text-gray-500 hover:text-white text-sm transition-colors">
            Return to Player Login
          </button>
        ) : (
          <button onClick={() => navigate('/admin/login')} className="text-gray-600 hover:text-purple-400 text-sm transition-colors flex items-center gap-1">
            <Shield size={14} /> Admin Access
          </button>
        )}
      </div>
    </div>
  );
}
