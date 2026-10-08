'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, LogOut } from 'lucide-react';
import { useRole } from '@/components/layout/RoleContext';

export function Header() {
  const pathname = usePathname();
  const { currentRole, currentUser, logoutUser } = useRole();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isHome = pathname === '/';
  const isAbout = pathname === '/about';
  const isProjects = pathname === '/#projects' || pathname.startsWith('/dashboard') || pathname.startsWith('/live_dashboard');

  return (
    <header className="w-full bg-[#ffffff] border-b border-[#dde1dc]">
      <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Institutional Wordmark */}
        <Link href="/" className="flex flex-col group">
          <span className="font-serif font-semibold text-xl text-[#1a1f1c] tracking-tight group-hover:text-[#1f4d3a] transition-colors">
            Birdsong Observatory
          </span>
          <span className="font-sans text-xs text-[#5a635d] tracking-normal">
            Bird Ecology Lab, IISER Tirupati
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8 font-sans text-sm font-medium text-[#1a1f1c]">
          <Link
            href="/#projects"
            className="text-[#5a635d] hover:text-[#1f4d3a] transition-colors"
          >
            Projects
          </Link>

          <Link
            href="/about"
            className={`transition-colors ${
              isAbout 
                ? 'text-[#1f4d3a] font-semibold underline underline-offset-4' 
                : 'text-[#5a635d] hover:text-[#1f4d3a]'
            }`}
          >
            About
          </Link>

          {/* Admin link if permitted */}
          {(currentRole === 'Admin' || currentRole === 'Project Manager' || currentRole === 'Site Manager') && (
            <Link
              href="/admin/pam"
              className="text-xs font-mono font-medium px-2.5 py-1 border border-[#dde1dc] rounded-md text-[#1f4d3a] hover:bg-[#f5f6f4] transition-colors"
            >
              Admin Console
            </Link>
          )}

          {/* Sign In / User Status */}
          {currentUser && currentUser.role !== 'Public' ? (
            <div className="flex items-center gap-3 pl-4 border-l border-[#dde1dc] font-mono text-xs">
              <span className="text-[#1a1f1c] font-medium">{currentUser.name}</span>
              <button
                onClick={logoutUser}
                title="Sign out"
                className="text-[#5a635d] hover:text-[#1a1f1c] transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-[#5a635d] hover:text-[#1f4d3a] transition-colors"
            >
              Sign in
            </Link>
          )}
        </nav>

        {/* Mobile menu trigger */}
        <div className="flex md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-[#1a1f1c]"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#ffffff] border-b border-[#dde1dc] px-4 py-4 space-y-3 text-sm font-medium">
          <Link
            href="/#projects"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-1 text-[#1a1f1c]"
          >
            Projects
          </Link>
          <Link
            href="/about"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-1 text-[#1a1f1c]"
          >
            About
          </Link>
          {(currentRole === 'Admin' || currentRole === 'Project Manager' || currentRole === 'Site Manager') && (
            <Link
              href="/admin/pam"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1 text-[#1f4d3a] font-semibold"
            >
              Admin Console
            </Link>
          )}

          <div className="pt-3 border-t border-[#dde1dc] flex items-center justify-between font-mono text-xs">
            {currentUser && currentUser.role !== 'Public' ? (
              <button
                onClick={() => { logoutUser(); setMobileMenuOpen(false); }}
                className="text-[#b5651d] font-sans"
              >
                Sign out ({currentUser.name})
              </button>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-[#1f4d3a] font-sans"
              >
                Sign in &rarr;
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
