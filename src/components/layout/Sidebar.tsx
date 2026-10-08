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
  CheckSquare, 
  FileText, 
  Settings,
  Shield,
  Activity,
  Clock
} from 'lucide-react';
import { UserRole } from '@/types/database';

interface SidebarProps {
  currentRole: UserRole;
  onlineStationsCount: number;
}

export function Sidebar({ currentRole, onlineStationsCount }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { label: 'Summary', href: '/live_dashboard?tab=summary', icon: LayoutDashboard },
    { label: 'Spatial Map', href: '/map', icon: MapPin },
    { label: 'Species Accumulation', href: '/live_dashboard?tab=accumulation', icon: Activity },
    { label: 'Diurnal Activity Pattern', href: '/live_dashboard?tab=diurnal', icon: Clock },
    { label: 'Live Stream', href: '/live', icon: Radio, badge: 'LIVE' },
    { label: 'Stations & Nodes', href: '/stations', icon: Cpu, count: onlineStationsCount },
    { label: 'Species Catalog', href: '/species', icon: Bird },
    { label: 'Review Queue', href: '/review', icon: CheckSquare, roleRequired: ['Admin', 'Project Manager', 'Site Manager'] },
    { label: 'Reports & Export', href: '/reports', icon: FileText, roleRequired: ['Admin', 'Project Manager', 'Site Manager'] },
  ];

  return (
    <aside className="w-60 flex-shrink-0 bg-[#ffffff] border-r border-[#dde1dc] flex flex-col h-screen sticky top-0 text-[#1a1f1c] font-sans">
      
      {/* Brand Header */}
      <div className="p-4 border-b border-[#dde1dc]">
        <div className="font-serif font-semibold text-[#1a1f1c] text-sm">
          Birdsong Observatory
        </div>
        <div className="text-[11px] text-[#5a635d]">
          Research Console
        </div>
      </div>

      {/* Role Banner */}
      <div className="px-4 py-2 border-b border-[#dde1dc] bg-[#f5f6f4] flex items-center justify-between text-xs font-mono">
        <span className="text-[#1f4d3a] font-semibold">{currentRole}</span>
        <span className="text-[10px] text-[#5a635d]">v2.4</span>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          if (item.roleRequired && !item.roleRequired.includes(currentRole)) {
            return null;
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xs transition-colors ${
                isActive
                  ? 'bg-[#1f4d3a] text-white font-semibold'
                  : 'text-[#1a1f1c] hover:bg-[#f5f6f4]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#5a635d]'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[9px] font-mono px-1 py-0.2 rounded-xs ${isActive ? 'bg-white text-[#1f4d3a]' : 'bg-[#1f4d3a] text-white'}`}>
                  {item.badge}
                </span>
              )}
              {item.count !== undefined && (
                <span className={`text-[10px] font-mono ${isActive ? 'text-white' : 'text-[#5a635d]'}`}>
                  {item.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Telemetry Footer */}
      <div className="p-3 border-t border-[#dde1dc] text-[11px] font-mono text-[#5a635d]">
        <div className="flex justify-between">
          <span>Active Nodes</span>
          <strong className="text-[#1a1f1c]">{onlineStationsCount}</strong>
        </div>
      </div>
    </aside>
  );
}
