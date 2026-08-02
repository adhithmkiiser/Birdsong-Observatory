'use client';

import React from 'react';
import './globals.css';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { RoleProvider, useRole } from '@/components/layout/RoleContext';
import { supabase } from '@/lib/supabase';

const OFFLINE_THRESHOLD_MS = 2 * 60 * 1000;
const STATION_HEARTBEAT_INTERVAL_MS = 60 * 1000;

function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { currentRole } = useRole();
  const [recorders, setRecorders] = React.useState<any[]>([]);
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    async function loadRecorders() {
      const { data } = await supabase.from('recorders_registry')
        .select('status, last_ping')
        .eq('project_type', 'Live');
      if (data) setRecorders(data);
    }
    loadRecorders();
    const interval = setInterval(() => {
      setNow(Date.now());
      loadRecorders();
    }, STATION_HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const onlineStations = React.useMemo(() => {
    return recorders.filter((r: any) => {
      if (!r.last_ping) return false;
      return Date.now() - new Date(r.last_ping).getTime() < OFFLINE_THRESHOLD_MS;
    }).length;
  }, [recorders, now]);

  // Determine if current route is part of the Dashboard section where Sidebar should appear
  const dashboardRoutes = [
    '/dashboard',
    '/live_dashboard',
    '/live',
    '/stations',
    '/projects',
    '/species',
    '/map',
    '/analytics',
    '/review',
    '/reports',
    '/settings'
  ];

  const isLantanaOrPamDashboard = pathname.startsWith('/dashboard/lantana') || pathname.startsWith('/dashboard/common');
  const isDashboardRoute = dashboardRoutes.some(r => pathname === r || pathname.startsWith(`${r}/`)) && !isLantanaOrPamDashboard;
  const isFullBleedRoute = pathname === '/home' || pathname === '/';

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen flex flex-col font-sans antialiased">
      <Header />

      <div className="flex-1 flex min-w-0">
        {/* Left Sidebar only renders on Dashboard pages */}
        {isDashboardRoute && (
          <Sidebar currentRole={currentRole} onlineStationsCount={onlineStations} />
        )}
        
        <main className={isFullBleedRoute ? "flex-1 w-full min-w-0" : `flex-1 p-6 overflow-y-auto w-full mx-auto space-y-6 max-w-7xl`}>
          {children}
        </main>
      </div>
    </div>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <RoleProvider>
          <LayoutInner>{children}</LayoutInner>
        </RoleProvider>
      </body>
    </html>
  );
}
