'use client';

import React, { useState } from 'react';
import { X, Lock, Mail, ShieldCheck, Key, LogIn, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { useRole } from '@/components/layout/RoleContext';
import { supabase } from '@/lib/supabase';

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

  const [mode, setMode] = useState<'login' | 'otp_reset' | 'change_temp'>('login');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const handleGenerateOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    const targetUser = usersList.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (!targetUser) {
      setLoading(false);
      setErrorMsg('No user account found with this email.');
      return;
    }

    const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
    try {
      await supabase
        .from('users')
        .update({
          password_hash: generatedOTP,
          is_one_time_password: true,
          must_change_password: true
        })
        .eq('email', targetUser.email);

      setLoading(false);
      setOtpCode(generatedOTP);
      setSuccessMsg(`One-Time Password generated! Use temporary password: ${generatedOTP}`);
      setMode('login');
    } catch (err) {
      setLoading(false);
      setErrorMsg('Failed to generate OTP. Please try again.');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await supabase
        .from('users')
        .update({
          password_hash: newPassword,
          is_one_time_password: false,
          must_change_password: false
        })
        .eq('email', email);

      setLoading(false);
      setSuccessMsg('Password updated successfully! Logging you in...');
      loginUser(email, newPassword);
      setTimeout(() => {
        onClose();
        setMode('login');
      }, 1000);
    } catch (err) {
      setLoading(false);
      setErrorMsg('Failed to update password.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    setTimeout(() => {
      const found = usersList.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
      const result = loginUser(email, password);
      setLoading(false);

      if (result.success) {
        if (found?.mustChangePassword || found?.isOneTimePassword) {
          setMode('change_temp');
          setSuccessMsg('One-time password verified! Please set your new permanent password.');
        } else {
          setSuccessMsg(result.message);
          setTimeout(() => {
            onClose();
          }, 1000);
        }
      } else {
        setErrorMsg(result.message);
      }
    }, 400);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col justify-between transform transition-all scale-100 font-sans">
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
            <h2 className="text-lg font-black tracking-tight">
              {mode === 'login' ? 'Sign In to BirdNET Cloud' : mode === 'change_temp' ? 'Set Permanent Password' : 'One-Time Password Reset'}
            </h2>
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

          {mode === 'login' && (
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-extrabold text-slate-700">Password / OTP</label>
                  <button
                    type="button"
                    onClick={() => setMode('otp_reset')}
                    className="text-[11px] font-bold text-indigo-600 hover:underline"
                  >
                    Forgot Password / Get OTP?
                  </button>
                </div>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="Enter password or temporary OTP"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              </button>
            </form>
          )}

          {mode === 'change_temp' && (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
                ⚠️ First Login Security: Please replace your one-time password with a new permanent password.
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1.5">New Permanent Password</label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{loading ? 'Updating Password...' : 'Save & Continue'}</span>
              </button>
            </form>
          )}

          {mode === 'otp_reset' && (
            <form onSubmit={handleGenerateOTP} className="space-y-4">
              <div>
                <label className="text-xs font-extrabold text-slate-700 block mb-1.5">Enter Registered Email</label>
                <input
                  type="email"
                  required
                  placeholder="name@birdsongobservatory.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>{loading ? 'Generating OTP...' : 'Generate One-Time Password'}</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-900"
              >
                Back to Sign In
              </button>
            </form>
          )}

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
                  onClick={() => {
                    setEmail(u.email);
                    setPassword(u.password || 'pass123');
                    loginUser(u.email, u.password || 'pass123');
                    onClose();
                  }}
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
