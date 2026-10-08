'use client';

import React from 'react';
import Link from 'next/link';
import { Database, Radio, Users, ArrowRight, ShieldCheck, Cpu, Upload } from 'lucide-react';
import { AdminNavTabs } from '@/components/admin/AdminNavTabs';
import { useRole } from '@/components/layout/RoleContext';

export default function AdminHubPage() {
  const { currentRole } = useRole();

  return (
    <div className="w-full max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 font-sans">
      
      {/* Centralized Admin Console Switcher */}
      <AdminNavTabs />

      {/* Header Banner */}
      <div className="p-6 md:p-8 rounded-2xl bg-[#ffffff] border border-[#dde1dc] space-y-2 shadow-xs">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f5f6f4] border border-[#dde1dc] text-[#1f4d3a] font-mono font-medium text-xs">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>ADMINISTRATION PORTAL</span>
        </div>
        <h1 className="text-3xl font-serif font-semibold text-[#1a1f1c] tracking-tight">
          Observatory Admin Hub
        </h1>
        <p className="text-[#5a635d] text-sm max-w-2xl leading-relaxed">
          Centralized administrative management for passive acoustic monitoring datasets, real-time Raspberry Pi detector telemetry, and institutional user access permissions.
        </p>
      </div>

      {/* 3 Console Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: PAM Projects Console */}
        <div className="p-6 rounded-2xl bg-[#ffffff] border border-[#dde1dc] flex flex-col justify-between space-y-5 hover:border-[#1f4d3a] transition-all group shadow-xs">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#f5f6f4] border border-[#dde1dc] flex items-center justify-center text-[#1f4d3a] group-hover:bg-[#1f4d3a] group-hover:text-white transition-colors">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-semibold text-xl text-[#1a1f1c]">
                PAM Projects Console
              </h2>
              <div className="font-mono text-xs text-[#5a635d] pt-0.5">
                Batch CSV &bull; Transects &bull; Taxa
              </div>
            </div>
            <p className="text-xs text-[#5a635d] leading-relaxed">
              Ingest BirdNET batch CSV result sheets, parse SD card recordings, manage project transects, register site GPS coordinates, and curate species ecological records.
            </p>
          </div>

          <Link
            href="/admin/pam"
            className="inline-flex items-center justify-between w-full px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#f5f6f4] hover:bg-[#1f4d3a] text-[#1f4d3a] hover:text-white border border-[#dde1dc] transition-all"
          >
            <span>Launch PAM Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Card 2: Live Detectors Console */}
        <div className="p-6 rounded-2xl bg-[#ffffff] border border-[#dde1dc] flex flex-col justify-between space-y-5 hover:border-[#1f4d3a] transition-all group shadow-xs">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#f5f6f4] border border-[#dde1dc] flex items-center justify-center text-[#1f4d3a] group-hover:bg-[#1f4d3a] group-hover:text-white transition-colors">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-semibold text-xl text-[#1a1f1c]">
                Live Detectors Console
              </h2>
              <div className="font-mono text-xs text-[#5a635d] pt-0.5">
                BirdNET-Pi &bull; Edge Nodes &bull; Sync
              </div>
            </div>
            <p className="text-xs text-[#5a635d] leading-relaxed">
              Monitor solar Raspberry Pi edge nodes, inspect delta sync queues, generate <code className="font-mono">birdnet_sync.py</code> systemd configurations, and manage live audio streams.
            </p>
          </div>

          <Link
            href="/admin/live"
            className="inline-flex items-center justify-between w-full px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#f5f6f4] hover:bg-[#1f4d3a] text-[#1f4d3a] hover:text-white border border-[#dde1dc] transition-all"
          >
            <span>Launch Live Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Card 3: User Auditing Console */}
        <div className="p-6 rounded-2xl bg-[#ffffff] border border-[#dde1dc] flex flex-col justify-between space-y-5 hover:border-[#1f4d3a] transition-all group shadow-xs">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#f5f6f4] border border-[#dde1dc] flex items-center justify-center text-[#1f4d3a] group-hover:bg-[#1f4d3a] group-hover:text-white transition-colors">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-semibold text-xl text-[#1a1f1c]">
                User Auditing Console
              </h2>
              <div className="font-mono text-xs text-[#5a635d] pt-0.5">
                Roles &bull; Passwords &bull; Permissions
              </div>
            </div>
            <p className="text-xs text-[#5a635d] leading-relaxed">
              Create and manage user accounts, issue one-time passwords, edit organizational permissions, and scope project access to PAM only, Live only, or Both.
            </p>
          </div>

          <Link
            href="/users"
            className="inline-flex items-center justify-between w-full px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#f5f6f4] hover:bg-[#1f4d3a] text-[#1f4d3a] hover:text-white border border-[#dde1dc] transition-all"
          >
            <span>Launch User Auditing</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

      </div>

    </div>
  );
}
