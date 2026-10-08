'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Lock, 
  Mail, 
  Key, 
  LogIn, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft,
  ShieldCheck
} from 'lucide-react';
import { useRole } from '@/components/layout/RoleContext';

export default function SignInPage() {
  const { loginUser, usersList, updateUserCredentials } = useRole();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const [mode, setMode] = useState<'login' | 'otp_reset' | 'change_temp'>('login');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleGenerateOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to reset password');

      setLoading(false);
      setSuccessMsg(
        result.dispatched
          ? `One-Time Password dispatched to ${email.trim()}. Check your inbox.`
          : 'Password reset request registered. Check your inbox or contact lab administrator.'
      );
      setMode('login');
    } catch (err) {
      setLoading(false);
      setErrorMsg('Failed to generate OTP. Please try again or contact support.');
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
    const user = usersList.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (!user) {
      setLoading(false);
      setErrorMsg('User record not found in observatory registry.');
      return;
    }
    try {
      await updateUserCredentials(user.id, {
        password: newPassword,
        isOneTimePassword: false,
        mustChangePassword: false
      });

      setLoading(false);
      setSuccessMsg('Password updated successfully. Redirecting to observatory...');
      loginUser(email, newPassword);
      setTimeout(() => router.push('/'), 800);
    } catch (err) {
      setLoading(false);
      setErrorMsg('Failed to update credentials.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    const result = await loginUser(email, password);
    setLoading(false);

    if (result.success) {
      if (result.user?.mustChangePassword || result.user?.isOneTimePassword) {
        setMode('change_temp');
        setSuccessMsg('Temporary credential verified. Please set your permanent research password.');
      } else {
        setSuccessMsg(result.message);
        setTimeout(() => router.push('/'), 800);
      }
    } else {
      setErrorMsg(result.message);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center px-4 py-12 bg-[#ffffff] font-sans">
      <div className="w-full max-w-md bg-[#ffffff] border border-[#dde1dc] rounded-2xl p-8 sm:p-10 shadow-xs space-y-6">
        
        {/* Header Branding */}
        <div className="space-y-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-[#5a635d] hover:text-[#1a1f1c] transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Observatory</span>
          </Link>

          <h1 className="font-serif font-semibold text-2xl sm:text-3xl text-[#1a1f1c] tracking-tight">
            {mode === 'login' ? 'Sign in to Observatory' : mode === 'change_temp' ? 'Set Permanent Password' : 'Reset Access Key'}
          </h1>
          <p className="text-xs text-[#5a635d]">
            Bird Ecology Lab &bull; IISER Tirupati Research Portal
          </p>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="p-3.5 rounded-lg bg-[#fbeee8] border border-[#943a29]/30 text-[#943a29] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-lg bg-[#eaf2ed] border border-[#1f4d3a]/30 text-[#1f4d3a] text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Mode 1: Normal Sign In */}
        {mode === 'login' && (
          <form onSubmit={handleSubmit} className="space-y-4 font-sans">
            <div className="space-y-1">
              <label className="text-xs font-mono font-medium text-[#5a635d] uppercase tracking-wider block">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#5a635d] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="name@birdsongobservatory.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#f5f6f4] border border-[#dde1dc] rounded-lg pl-10 pr-3.5 py-2.5 text-xs text-[#1a1f1c] placeholder-[#5a635d] focus:outline-none focus:border-[#1f4d3a] focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-mono font-medium text-[#5a635d] uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setMode('otp_reset')}
                  className="text-xs text-[#1f4d3a] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Key className="w-4 h-4 text-[#5a635d] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#f5f6f4] border border-[#dde1dc] rounded-lg pl-10 pr-3.5 py-2.5 text-xs text-[#1a1f1c] placeholder-[#5a635d] focus:outline-none focus:border-[#1f4d3a] focus:bg-white transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full rounded-lg text-xs font-semibold mt-2"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? 'Verifying credentials...' : 'Sign In'}</span>
            </button>
          </form>
        )}

        {/* Form Mode 2: Change Temp Password */}
        {mode === 'change_temp' && (
          <form onSubmit={handlePasswordChange} className="space-y-4 font-sans">
            <div className="p-3 rounded-lg bg-[#f5f6f4] border border-[#dde1dc] text-xs text-[#5a635d]">
              First login protocol: Please establish a permanent research password.
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono font-medium text-[#5a635d] uppercase tracking-wider block">
                New Permanent Password
              </label>
              <input
                type="password"
                required
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-[#f5f6f4] border border-[#dde1dc] rounded-lg px-3.5 py-2.5 text-xs text-[#1a1f1c] focus:outline-none focus:border-[#1f4d3a] focus:bg-white transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono font-medium text-[#5a635d] uppercase tracking-wider block">
                Confirm Password
              </label>
              <input
                type="password"
                required
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#f5f6f4] border border-[#dde1dc] rounded-lg px-3.5 py-2.5 text-xs text-[#1a1f1c] focus:outline-none focus:border-[#1f4d3a] focus:bg-white transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full rounded-lg text-xs font-semibold"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{loading ? 'Updating...' : 'Save and Continue'}</span>
            </button>
          </form>
        )}

        {/* Form Mode 3: OTP Reset */}
        {mode === 'otp_reset' && (
          <form onSubmit={handleGenerateOTP} className="space-y-4 font-sans">
            <div className="space-y-1">
              <label className="text-xs font-mono font-medium text-[#5a635d] uppercase tracking-wider block">
                Registered Institutional Email
              </label>
              <input
                type="email"
                required
                placeholder="name@birdsongobservatory.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#f5f6f4] border border-[#dde1dc] rounded-lg px-3.5 py-2.5 text-xs text-[#1a1f1c] focus:outline-none focus:border-[#1f4d3a] focus:bg-white transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full rounded-lg text-xs font-semibold"
            >
              <span>{loading ? 'Dispatched request...' : 'Send Access OTP'}</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('login')}
              className="w-full text-center text-xs text-[#5a635d] hover:text-[#1a1f1c] pt-1"
            >
              &larr; Back to sign in
            </button>
          </form>
        )}

        {/* Colophon Note */}
        <div className="pt-4 border-t border-[#dde1dc] text-center font-mono text-[11px] text-[#5a635d]">
          Authorized access for IISER Tirupati researchers &amp; conservation collaborators.
        </div>

      </div>
    </div>
  );
}
