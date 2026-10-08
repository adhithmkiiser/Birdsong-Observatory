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

    const channel = supabase
      .channel('public:recorders_registry')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'recorders_registry' },
        (payload) => {
          setNow(Date.now());
          setRecorders((prev) => {
            const index = prev.findIndex((r) => r.id === payload.new.id);
            if (index !== -1) {
              const newRecorders = [...prev];
              newRecorders[index] = payload.new;
              return newRecorders;
            }
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const onlineStations = React.useMemo(() => {
    return recorders.filter((r: any) => {
      if (!r.last_ping) return false;
      return Date.now() - new Date(r.last_ping).getTime() < OFFLINE_THRESHOLD_MS;
    }).length;
  }, [recorders, now]);

  // Determine if current route is part of the Admin Console section where Sidebar should appear
  const dashboardRoutes = [
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

  const isDedicatedDashboard = pathname.startsWith('/dashboard') || pathname.startsWith('/live_dashboard');
  const isDashboardRoute = dashboardRoutes.some(r => pathname === r || pathname.startsWith(`${r}/`)) && !isDedicatedDashboard;
  const isFullBleedRoute = pathname === '/home' || pathname === '/' || pathname === '/about' || isDedicatedDashboard;

  return (
    <div className="bg-[#ffffff] text-[#1a1f1c] min-h-screen flex flex-col font-sans antialiased">
      <Header />

      <div className="flex-1 flex min-w-0">
        {/* Left Sidebar only renders on Admin Console pages */}
        {isDashboardRoute && (
          <Sidebar currentRole={currentRole} onlineStationsCount={onlineStations} />
        )}
        
        <main className={
          isDedicatedDashboard
            ? "flex-1 w-full min-w-0 h-[calc(100vh-80px)] overflow-hidden"
            : isFullBleedRoute 
              ? "flex-1 w-full min-w-0" 
              : "flex-1 p-6 overflow-y-auto w-full mx-auto space-y-6 max-w-7xl"
        }>
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
