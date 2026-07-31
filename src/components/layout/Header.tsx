'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Menu, 
  X, 
  ChevronDown, 
  ShieldCheck, 
  User as UserIcon, 
  LogOut, 
  Radio, 
  ExternalLink,
  Database,
  Users
} from 'lucide-react';
import { useRole } from '@/components/layout/RoleContext';

export function Header() {
  const pathname = usePathname();
  const { currentRole, currentUser, logoutUser } = useRole();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isHomeActive = pathname === '/';
  const isAboutActive = pathname === '/about';
  const isDashboardActive = pathname === '/#projects' || pathname.startsWith('/dashboard');

  const toggleDropdown = (name: string) => {
    setActiveDropdown(prev => prev === name ? null : name);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          
          {/* Brand Logo & Identity */}
          <Link href="/" className="flex items-center gap-3.5 group">
            <div className="w-11 h-11 rounded-2xl overflow-hidden bg-emerald-900 border border-slate-200 shadow-md flex-shrink-0 group-hover:scale-105 transition">
              <img
                src="/Birdlab_logo.jpeg"
                alt="IISER Tirupati Bird Lab Logo"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1 text-slate-900 tracking-tight">
                <span className="font-black text-lg text-emerald-700">birdsong</span>
                <span className="font-black text-lg text-slate-900">observatory</span>
              </div>
              <span className="text-[10px] font-black text-slate-700 tracking-widest uppercase">
                IISER TIRUPATI
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links (Exact order requested) */}
          <nav className="hidden lg:flex items-center gap-1 font-extrabold text-xs">
            {/* 1. Home */}
            <Link
              href="/"
              className={`px-4 py-2 rounded-xl transition ${
                isHomeActive 
                  ? 'bg-emerald-50 text-emerald-800 font-black border border-emerald-200/80 shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Home
            </Link>

            {/* 2. Dashboard -> Navigates directly to Projects section on Homepage */}
            <Link
              href="/#projects"
              className={`px-4 py-2 rounded-xl transition ${
                isDashboardActive 
                  ? 'bg-indigo-50 text-indigo-800 font-black border border-indigo-200/80 shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Dashboard
            </Link>

            {/* 3. About */}
            <Link
              href="/about"
              className={`px-4 py-2 rounded-xl transition ${
                isAboutActive 
                  ? 'bg-emerald-50 text-emerald-800 font-black border border-emerald-200/80 shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              About
            </Link>

            {/* 4. Bird Lab (External) */}
            <a
              href="https://www.skyisland.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-slate-100 transition inline-flex items-center gap-1"
            >
              <span>Bird Lab</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            {/* 5. Admin Console Dropdown */}
            {(currentRole === 'Admin' || currentRole === 'Project Manager' || currentRole === 'Site Manager') && (
              <div className="relative ml-2" ref={dropdownRef}>
                <button
                  onClick={() => toggleDropdown('admin')}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 text-white font-black shadow-md shadow-emerald-600/20 hover:opacity-95 transition flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin Consoles</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {activeDropdown === 'admin' && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-2xl p-2 space-y-1 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      Administrative Consoles
                    </div>

                    <Link
                      href="/admin/pam"
                      onClick={() => setActiveDropdown(null)}
                      className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-indigo-50 text-slate-800 hover:text-indigo-800 transition"
                    >
                      <Database className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-extrabold text-slate-900">PAM Admin Console</div>
                        <div className="text-[10px] text-slate-500 font-medium font-sans">Full CSV parser, sites & copy editor</div>
                      </div>
                    </Link>

                    {currentRole === 'Admin' && (
                      <>
                        <Link
                          href="/admin/live"
                          onClick={() => setActiveDropdown(null)}
                          className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-emerald-50 text-slate-800 hover:text-emerald-800 transition"
                        >
                          <Radio className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0 animate-pulse" />
                          <div>
                            <div className="font-extrabold text-slate-900">Live Recorder Admin</div>
                            <div className="text-[10px] text-slate-500 font-medium font-sans">Realtime stream controls & gain DSP</div>
                          </div>
                        </Link>

                        <div className="border-t border-slate-100 my-1"></div>

                        <Link
                          href="/users"
                          onClick={() => setActiveDropdown(null)}
                          className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-100 text-slate-700 font-bold transition"
                        >
                          <Users className="w-3.5 h-3.5 text-slate-500" />
                          <span>User Roles & Permissions</span>
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* User Auth Section */}
          <div className="hidden lg:flex items-center gap-3">
            {currentUser && currentUser.role !== 'Public' ? (
              <div className="flex items-center gap-2.5">
                <div className="flex flex-col text-right">
                  <span className="text-xs font-black text-slate-900">{currentUser.name}</span>
                  <span className="text-[10px] font-bold text-indigo-600">{currentUser.role}</span>
                </div>
                <button
                  onClick={logoutUser}
                  title="Logout Session"
                  className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md shadow-slate-900/10 transition"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-slate-200 px-4 pt-2 pb-6 space-y-3 font-extrabold text-xs">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="block p-3 rounded-xl hover:bg-slate-100 text-slate-900"
            >
              Home
            </Link>
            <Link
              href="/#projects"
              onClick={() => setMobileMenuOpen(false)}
              className="block p-3 rounded-xl hover:bg-slate-100 text-slate-900"
            >
              Dashboard
            </Link>
            <Link
              href="/about"
              onClick={() => setMobileMenuOpen(false)}
              className="block p-3 rounded-xl hover:bg-slate-100 text-slate-900"
            >
              About
            </Link>

            {currentUser && currentUser.role !== 'Public' ? (
              <button
                onClick={() => { logoutUser(); setMobileMenuOpen(false); }}
                className="w-full text-left p-3 rounded-xl bg-rose-50 text-rose-700 font-black flex items-center justify-between"
              >
                <span>Logout ({currentUser.name})</span>
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full p-3 rounded-xl bg-indigo-600 text-white font-black text-center block"
              >
                Sign In
              </Link>
            )}
          </div>
        )}
      </header>

    </>
  );
}
