'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Radio, 
  Cpu, 
  FolderKanban, 
  Bird, 
  MapPin, 
  BarChart3, 
  CheckSquare, 
  FileText, 
  Settings,
  Shield,
  Users,
  Activity,
  ChevronRight
} from 'lucide-react';
import { UserRole } from '@/types/database';
import { useRole } from '@/components/layout/RoleContext';

interface SidebarProps {
  currentRole: UserRole;
  onlineStationsCount: number;
}

export function Sidebar({ currentRole, onlineStationsCount }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Live Stream', href: '/live', icon: Radio, badge: 'LIVE' },
    { label: 'Stations', href: '/stations', icon: Cpu, count: onlineStationsCount },
    { label: 'Projects', href: '/projects', icon: FolderKanban },
    { label: 'Species', href: '/species', icon: Bird },
    { label: 'Map', href: '/map', icon: MapPin },
    { label: 'Analytics', href: '/analytics', icon: BarChart3 },
    { label: 'Review Queue', href: '/review', icon: CheckSquare, roleRequired: ['Admin', 'Project Manager', 'Site Manager'] },
    { label: 'User Management', href: '/users', icon: Users, roleRequired: ['Admin', 'Project Manager'] },
    { label: 'Reports', href: '/reports', icon: FileText, roleRequired: ['Admin', 'Project Manager'] },
    { label: 'Settings', href: '/settings', icon: Settings, roleRequired: ['Admin'] },
  ];

  const getRoleStyle = (r: UserRole) => {
    switch (r) {
      case 'Admin': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Project Manager': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Site Manager': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Public': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <aside className="w-64 flex-shrink-0 bg-white/90 backdrop-blur-xl border-r border-slate-200/80 flex flex-col h-screen sticky top-0 text-slate-800 shadow-sm z-30">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-100 flex items-center gap-3.5 bg-slate-50/40">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 transform hover:scale-105 transition duration-300">
          <Bird className="w-5 h-5" />
        </div>
        <div>
          <div className="font-black text-slate-900 tracking-tight text-sm flex items-center gap-1">
            BirdNET<span className="text-emerald-600 font-black">Cloud</span>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">IISER Tirupati Bird Lab</p>
        </div>
      </div>

      {/* Role Banner */}
      <div className={`mx-3 mt-3.5 p-3 rounded-2xl border flex items-center justify-between shadow-xs transition-all duration-300 ${getRoleStyle(currentRole)}`}>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" />
          <span className="text-xs font-black tracking-tight">{currentRole}</span>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-white/80 border border-slate-200/80 text-slate-700 shadow-2xs">v2.4</span>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <p className="px-2 text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Platform Navigation</p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          if (item.roleRequired && !item.roleRequired.includes(currentRole)) {
            return null;
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all duration-200 group ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-50 via-indigo-50/80 to-emerald-50 text-indigo-700 font-black border-l-4 border-indigo-600 shadow-xs translate-x-1'
                  : 'hover:bg-slate-100/80 text-slate-600 hover:text-slate-900 font-semibold hover:translate-x-1'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-700'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-xs animate-pulse">
                  {item.badge}
                </span>
              )}
              {item.count !== undefined && (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {item.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Live System Telemetry Status */}
      <div className="p-3.5 m-3 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/80 border border-slate-200 text-xs shadow-xs">
        <div className="flex items-center justify-between text-slate-700 mb-2">
          <span className="flex items-center gap-2 text-[11px] font-extrabold text-slate-800">
            <Activity className="w-3.5 h-3.5 text-emerald-600 animate-spin" /> Supabase Engine
          </span>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
        </div>
        <div className="text-[10px] text-slate-500 flex justify-between font-semibold">
          <span>Latency: <strong className="text-emerald-600">18ms</strong></span>
          <span>Nodes: <strong className="text-slate-900">{onlineStationsCount} Active</strong></span>
        </div>
      </div>
    </aside>
  );
}
