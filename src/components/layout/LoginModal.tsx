'use client';

import React, { useState } from 'react';
import { X, Lock, Mail, ShieldCheck, Key, LogIn, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { useRole } from '@/components/layout/RoleContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { loginUser, usersList } = useRole();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    setTimeout(() => {
      const result = loginUser(email, password);
      setLoading(false);
      if (result.success) {
        setSuccessMsg(result.message);
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        setErrorMsg(result.message);
      }
    }, 400);
  };

  const handleQuickDemoLogin = (userEmail: string, userPass?: string) => {
    setEmail(userEmail);
    setPassword(userPass || 'admin123Password!');
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    setTimeout(() => {
      const result = loginUser(userEmail, userPass || 'admin123Password!');
      setLoading(false);
      if (result.success) {
        setSuccessMsg(result.message);
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        setErrorMsg(result.message);
      }
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col justify-between transform transition-all scale-100">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-[#022c22] via-[#0f172a] to-[#1e1b4b] text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400">
              <Lock className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-black tracking-tight">Sign In to BirdNET Cloud</h2>
          </div>
          <p className="text-xs text-slate-300 font-medium">IISER Tirupati Bioacoustics Wildlife Monitoring</p>
        </div>

        {/* Body Form */}
        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-extrabold text-slate-700 block mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="name@birdsongobservatory.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-extrabold text-slate-700 block mb-1.5">Password</label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-semibold"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-lg shadow-indigo-600/25 transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>Authenticating...</>
              ) : (
                <>
                  <LogIn className="w-4 h-4" /> Sign In to Account
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Quick Demo Roles Auto-Login:
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {usersList.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleQuickDemoLogin(u.email, u.password)}
                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 text-left transition"
                >
                  <div className="font-extrabold text-slate-900 text-[11px] truncate">{u.name}</div>
                  <div className="text-[10px] text-slate-500 font-semibold">{u.role}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
