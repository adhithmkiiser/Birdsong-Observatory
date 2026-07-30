'use client';

import React from 'react';
import './globals.css';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { RoleProvider, useRole } from '@/components/layout/RoleContext';
import { supabase } from '@/lib/supabase';

function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { currentRole } = useRole();
  const [onlineStations, setOnlineStations] = React.useState(1);

  React.useEffect(() => {
    supabase.from('stations').select('id', { count: 'exact' }).eq('status', 'online').then(({ count }) => {
      setOnlineStations(count && count > 0 ? count : 1);
    });
  }, []);

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
    '/settings',
    '/users'
  ];

  const isTstOrPamDashboard = pathname.startsWith('/dashboard/tst') || pathname.startsWith('/dashboard/common');
  const isDashboardRoute = dashboardRoutes.some(r => pathname === r || pathname.startsWith(`${r}/`)) && !isTstOrPamDashboard;

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen flex flex-col font-sans antialiased">
      <Header />

      <div className="flex-1 flex min-w-0">
        {/* Left Sidebar only renders on Dashboard pages */}
        {isDashboardRoute && (
          <Sidebar currentRole={currentRole} onlineStationsCount={onlineStations} />
        )}
        
        <main className={`flex-1 p-6 overflow-y-auto w-full mx-auto space-y-6 ${
          isDashboardRoute ? 'max-w-7xl' : 'max-w-7xl'
        }`}>
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
