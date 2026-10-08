'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Database, Radio, Users, Eye } from 'lucide-react';
import { useRole } from '@/components/layout/RoleContext';

export function AdminNavTabs() {
  const pathname = usePathname();
  const { currentRole } = useRole();

  const isPam = pathname.startsWith('/admin/pam');
  const isLive = pathname.startsWith('/admin/live');
  const isVisibility = pathname.startsWith('/admin/visibility');
  const isUsers = pathname.startsWith('/users');

  return (
    <div className="w-full bg-[#f5f6f4] border border-[#dde1dc] rounded-xl p-1.5 flex items-center gap-1.5 font-sans text-xs">
      <Link
        href="/admin/pam"
        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-medium transition-all ${
          isPam
            ? 'bg-[#ffffff] text-[#1f4d3a] font-semibold shadow-xs border border-[#dde1dc]'
            : 'text-[#5a635d] hover:text-[#1a1f1c] hover:bg-[#ffffff]/50'
        }`}
      >
        <Database className="w-3.5 h-3.5 text-[#1f4d3a]" />
        <span>PAM Projects Console</span>
      </Link>

      <Link
        href="/admin/live"
        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-medium transition-all ${
          isLive
            ? 'bg-[#ffffff] text-[#1f4d3a] font-semibold shadow-xs border border-[#dde1dc]'
            : 'text-[#5a635d] hover:text-[#1a1f1c] hover:bg-[#ffffff]/50'
        }`}
      >
        <Radio className="w-3.5 h-3.5 text-[#1f4d3a]" />
        <span>Live Detectors Console</span>
      </Link>

      <Link
        href="/admin/visibility"
        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-medium transition-all ${
          isVisibility
            ? 'bg-[#ffffff] text-[#1f4d3a] font-semibold shadow-xs border border-[#dde1dc]'
            : 'text-[#5a635d] hover:text-[#1a1f1c] hover:bg-[#ffffff]/50'
        }`}
      >
        <Eye className="w-3.5 h-3.5 text-[#1f4d3a]" />
        <span>Public Visibility Console</span>
      </Link>

      {currentRole === 'Admin' && (
        <Link
          href="/users"
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-medium transition-all ${
            isUsers
              ? 'bg-[#ffffff] text-[#1f4d3a] font-semibold shadow-xs border border-[#dde1dc]'
              : 'text-[#5a635d] hover:text-[#1a1f1c] hover:bg-[#ffffff]/50'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-[#1f4d3a]" />
          <span>User Auditing Console</span>
        </Link>
      )}
    </div>
  );
}
