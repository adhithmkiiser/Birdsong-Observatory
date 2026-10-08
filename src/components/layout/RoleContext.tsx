'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, PublicVisibilitySettings, DashboardMenuVisibility, User } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/apiClient';

interface RoleContextType {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  currentUser: User;
  setCurrentUser: (user: User) => void;
  usersList: User[];
  loginUser: (email: string, pass: string) => Promise<{ success: boolean; message: string; user?: User }>;
  logoutUser: () => void;
  updateUserCredentials: (userId: string, updates: Partial<User>) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  addUser: (user: User) => Promise<void>;
  visibilitySettings: PublicVisibilitySettings;
  updateVisibilitySetting: (key: keyof PublicVisibilitySettings, val: boolean) => void;
  updateMenuVisibility: (dashboardType: 'commonPam' | 'lantanaPam' | 'liveRecorder', tabId: string, visible: boolean, scopeKey?: string) => void;
  isTabVisibleForPublic: (dashboardType: 'commonPam' | 'lantanaPam' | 'liveRecorder', tabId: string, scopeKey?: string) => boolean;
  refreshUsers: () => Promise<void>;
}

const defaultPublicUser: User = {
  id: 'usr-public',
  name: 'Public Guest',
  email: 'public@birdlab.in',
  password: '',
  role: 'Public',
  organization: 'Public Network',
  status: 'active',
  createdAt: '2026-01-15',
  lastLogin: 'Never'
};

const defaultMenuVisibility: DashboardMenuVisibility = {
  commonPam: {
    summary: true,
    map: true,
    heatmap: true,
    trends: true,
    diurnal: true,
    diversity: true
  },
  lantanaPam: {
    summary: true,
    map: true,
    heatmap: true,
    richness: true,
    explorer: true,
    indicators: true,
    performance: true
  },
  liveRecorder: {
    summary: true,
    map: true,
    accumulation: true,
    diurnal: true,
    live: true,
    stations: true,
    species: true,
    review: false,
    reports: false
  }
};

const defaultVisibilitySettings: PublicVisibilitySettings = {
  showUnverifiedDetections: true,
  allowAudioDownloads: true,
  showExactGPSCoordinates: true,
  showTelemetryMetrics: true,
  allowPublicReports: false,
  dashboardMenuVisibility: defaultMenuVisibility,
  scopedMenuVisibility: {}
};

const mapDbUserToUser = (dbUser: any): User => ({
  id: dbUser.id,
  name: dbUser.full_name || dbUser.name || 'User',
  email: dbUser.email,
  password: dbUser.password_hash || dbUser.password || '',
  role: dbUser.role as any,
  organization: dbUser.organization || 'IISER Tirupati Bird Lab',
  projectScopePermissions: dbUser.project_scope_permissions || [],
  assignedProjects: dbUser.assigned_projects || [],
  assignedSites: dbUser.assigned_sites || [],
  isOneTimePassword: dbUser.is_one_time_password || false,
  mustChangePassword: dbUser.must_change_password || false,
  status: (dbUser.status as any) || 'active',
  createdAt: dbUser.created_at ? dbUser.created_at.split('T')[0] : '2026-01-15',
  lastLogin: dbUser.last_login || 'Never'
});

const mapUserToDbUser = (user: User) => ({
  id: user.id,
  full_name: user.name,
  email: user.email,
  password_hash: user.password || '',
  role: user.role,
  organization: user.organization,
  assigned_project_type: user.assignedProjectType || 'Both',
  project_scope_permissions: user.projectScopePermissions || [],
  assigned_projects: user.assignedProjects || [],
  assigned_sites: user.assignedSites || [],
  is_one_time_password: user.isOneTimePassword || false,
  must_change_password: user.mustChangePassword || false,
  created_at: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString()
});

const RoleContext = createContext<RoleContextType>({
  currentRole: 'Public',
  setCurrentRole: () => {},
  currentUser: defaultPublicUser,
  setCurrentUser: () => {},
  usersList: [],
  loginUser: async () => ({ success: false, message: '' }),
  logoutUser: () => {},
  updateUserCredentials: async () => {},
  deleteUser: async () => {},
  addUser: async () => {},
  visibilitySettings: defaultVisibilitySettings,
  updateVisibilitySetting: () => {},
  updateMenuVisibility: () => {},
  isTabVisibleForPublic: () => true,
  refreshUsers: async () => {},
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [usersList, setUsersList] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User>(defaultPublicUser);
  const [currentRole, setCurrentRoleState] = useState<UserRole>('Public');
  const [visibilitySettings, setVisibilitySettings] = useState<PublicVisibilitySettings>(defaultVisibilitySettings);

  const refreshUsers = async () => {
    try {
      const { data, error } = await supabase.from('users').select('*').neq('email', 'system_settings@birdlab.in').order('created_at', { ascending: true });
      if (!error && data && data.length > 0) {
        setUsersList(data.map(mapDbUserToUser));
      }
    } catch (e) {
      console.error('Failed to load users from database:', e);
    }
  };

  useEffect(() => {
    async function initSession() {
      // Restore logged-in session from localStorage if present
      const stored = typeof window !== 'undefined' ? localStorage.getItem('birdlab-session') : null;
      const sessionEmail = stored ? JSON.parse(stored).email : null;
      if (sessionEmail) {
        const { data, error } = await supabase.from('users').select('*').ilike('email', sessionEmail).single();
        if (data && !error) {
          const mapped = mapDbUserToUser(data);
          setCurrentUser(mapped);
          setCurrentRoleState(mapped.role);
          if (mapped.role === 'Admin') {
            await refreshUsers();
          }
        }
      }
    }
    initSession();
  }, []);

  const setCurrentRole = (role: UserRole) => {
    setCurrentRoleState(role);
    setCurrentUser(prev => ({ ...prev, role }));
  };

  const loginUser = async (email: string, pass: string): Promise<{ success: boolean; message: string; user?: User }> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('email', email.trim())
        .single();

      if (error || !data) {
        return { success: false, message: 'No account found with this email address.' };
      }

      if (data.password_hash && data.password_hash !== pass) {
        return { success: false, message: 'Incorrect password. Please verify your credentials.' };
      }

      if (data.status && data.status !== 'active') {
        return { success: false, message: 'This account is currently suspended or inactive.' };
      }

      const mapped = mapDbUserToUser(data);
      const updated = { ...mapped, lastLogin: 'Just now' };
      setCurrentUser(updated);
      setCurrentRoleState(updated.role);

      // Persist session
      if (typeof window !== 'undefined') {
        localStorage.setItem('birdlab-session', JSON.stringify({ email: updated.email }));
      }

      // If user is admin, also refresh full usersList
      if (updated.role === 'Admin') {
        await refreshUsers();
      }

      // Save last login time to DB asynchronously
      apiFetch('/api/db/users', {
        method: 'PUT',
        body: JSON.stringify({ id: mapped.id, last_login: new Date().toISOString() })
      }, updated).catch(e => console.error('Failed to update last login', e));

      return { success: true, message: `Welcome back, ${mapped.name}!`, user: updated };
    } catch (err: any) {
      return { success: false, message: err.message || 'Login failed.' };
    }
  };

  const logoutUser = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('birdlab-session');
    }
    setCurrentUser(defaultPublicUser);
    setCurrentRoleState('Public');
    setUsersList([]);
  };

  const updateUserCredentials = async (userId: string, updates: Partial<User>) => {
    setUsersList(prev => prev.map(u => {
      if (u.id === userId) {
        const updated = { ...u, ...updates };
        if (currentUser.id === userId) {
          setCurrentUser(updated);
          if (updates.role) setCurrentRoleState(updates.role);
        }
        return updated;
      }
      return u;
    }));

    // Update in Supabase
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.full_name = updates.name;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.password !== undefined) dbUpdates.password_hash = updates.password;
    if (updates.isOneTimePassword !== undefined) dbUpdates.is_one_time_password = updates.isOneTimePassword;
    if (updates.mustChangePassword !== undefined) dbUpdates.must_change_password = updates.mustChangePassword;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.organization !== undefined) dbUpdates.organization = updates.organization;
    if (updates.assignedProjectType !== undefined) dbUpdates.assigned_project_type = updates.assignedProjectType;
    if (updates.assignedProjects !== undefined) dbUpdates.assigned_projects = updates.assignedProjects;
    if (updates.assignedSites !== undefined) dbUpdates.assigned_sites = updates.assignedSites;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.lastLogin !== undefined && updates.lastLogin !== 'Never') {
      dbUpdates.last_login = updates.lastLogin;
    }

    try {
      await apiFetch('/api/db/users', {
        method: 'PUT',
        body: JSON.stringify({ id: userId, ...dbUpdates })
      }, currentUser);
    } catch (e: any) {
      console.warn('API error updating user, attempting direct DB update:', e);
      try {
        const { error: directErr } = await supabase.from('users').update(dbUpdates).eq('id', userId);
        if (directErr) throw directErr;
      } catch (err: any) {
        console.error('Direct DB update failed:', err);
        alert('Error updating user in database: ' + (e.message || err.message));
      }
    }
  };

  const deleteUser = async (userId: string) => {
    setUsersList(prev => prev.filter(u => u.id !== userId));
    try {
      await apiFetch(`/api/db/users?id=${userId}`, { method: 'DELETE' }, currentUser);
    } catch (e: any) {
      console.warn('API error deleting user, attempting direct DB delete:', e);
      try {
        const { error: directErr } = await supabase.from('users').delete().eq('id', userId);
        if (directErr) throw directErr;
      } catch (err: any) {
        console.error('Direct DB delete failed:', err);
        alert('Error deleting user in database: ' + (e.message || err.message));
      }
    }
  };

  const addUser = async (newUser: User) => {
    const dbUser = mapUserToDbUser(newUser);
    try {
      await apiFetch('/api/db/users', {
        method: 'POST',
        body: JSON.stringify(dbUser)
      }, currentUser);
      setUsersList(prev => [...prev, newUser]);
    } catch (e: any) {
      console.warn('API error adding user, attempting direct DB insert:', e);
      try {
        const { error: directErr } = await supabase.from('users').insert([dbUser]);
        if (!directErr) {
          setUsersList(prev => [...prev, newUser]);
          return;
        }
        throw directErr;
      } catch (err: any) {
        console.error('Direct DB insert failed:', err);
        alert('Error adding user to database: ' + (e.message || err.message));
      }
    }
  };

  useEffect(() => {
    // 1. Restore visibility settings from localStorage first for instant hydration
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('birdlab-visibility-settings') : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        setVisibilitySettings(prev => ({
          ...prev,
          ...parsed,
          dashboardMenuVisibility: {
            commonPam: { ...defaultMenuVisibility.commonPam, ...(parsed.dashboardMenuVisibility?.commonPam || {}) },
            lantanaPam: { ...defaultMenuVisibility.lantanaPam, ...(parsed.dashboardMenuVisibility?.lantanaPam || {}) },
            liveRecorder: { ...defaultMenuVisibility.liveRecorder, ...(parsed.dashboardMenuVisibility?.liveRecorder || {}) },
          },
          scopedMenuVisibility: parsed.scopedMenuVisibility || {}
        }));
      }
    } catch (e) {
      console.warn('Failed to load local visibility settings:', e);
    }

    // 2. Fetch latest visibility settings from database in background
    async function syncRemoteSettings() {
      try {
        const res = await fetch('/api/db/settings');
        if (res.ok) {
          const data = await res.json();
          if (data?.settings) {
            const remote = data.settings;
            setVisibilitySettings(prev => {
              const merged = {
                ...prev,
                ...remote,
                dashboardMenuVisibility: {
                  commonPam: { ...defaultMenuVisibility.commonPam, ...(remote.dashboardMenuVisibility?.commonPam || {}) },
                  lantanaPam: { ...defaultMenuVisibility.lantanaPam, ...(remote.dashboardMenuVisibility?.lantanaPam || {}) },
                  liveRecorder: { ...defaultMenuVisibility.liveRecorder, ...(remote.dashboardMenuVisibility?.liveRecorder || {}) },
                },
                scopedMenuVisibility: remote.scopedMenuVisibility || {}
              };
              if (typeof window !== 'undefined') {
                localStorage.setItem('birdlab-visibility-settings', JSON.stringify(merged));
              }
              return merged;
            });
          }
        }
      } catch (err) {
        console.warn('Background settings sync error:', err);
      }
    }
    syncRemoteSettings();
  }, []);

  const updateVisibilitySetting = (key: keyof PublicVisibilitySettings, val: boolean) => {
    setVisibilitySettings(prev => {
      const updated = { ...prev, [key]: val };
      if (typeof window !== 'undefined') {
        localStorage.setItem('birdlab-visibility-settings', JSON.stringify(updated));
      }
      // Sync to database
      apiFetch('/api/db/settings', {
        method: 'PUT',
        body: JSON.stringify(updated)
      }, currentUser).catch(e => console.warn('Failed to save settings to server:', e));
      return updated;
    });
  };

  const updateMenuVisibility = (
    dashboardType: 'commonPam' | 'lantanaPam' | 'liveRecorder',
    tabId: string,
    visible: boolean,
    scopeKey?: string
  ) => {
    setVisibilitySettings(prev => {
      let updated: PublicVisibilitySettings;
      if (scopeKey && scopeKey !== 'ALL') {
        const scoped = { ...(prev.scopedMenuVisibility || {}) };
        const existingScope = { ...(scoped[scopeKey] || {}) };
        existingScope[tabId] = visible;
        scoped[scopeKey] = existingScope;
        updated = { ...prev, scopedMenuVisibility: scoped };
      } else {
        const menuVis = {
          commonPam: { ...(prev.dashboardMenuVisibility?.commonPam || defaultMenuVisibility.commonPam) },
          lantanaPam: { ...(prev.dashboardMenuVisibility?.lantanaPam || defaultMenuVisibility.lantanaPam) },
          liveRecorder: { ...(prev.dashboardMenuVisibility?.liveRecorder || defaultMenuVisibility.liveRecorder) }
        };
        menuVis[dashboardType] = { ...menuVis[dashboardType], [tabId]: visible };
        updated = { ...prev, dashboardMenuVisibility: menuVis };
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('birdlab-visibility-settings', JSON.stringify(updated));
      }
      // Sync to database
      apiFetch('/api/db/settings', {
        method: 'PUT',
        body: JSON.stringify(updated)
      }, currentUser).catch(e => console.warn('Failed to save settings to server:', e));
      return updated;
    });
  };

  const isTabVisibleForPublic = (
    dashboardType: 'commonPam' | 'lantanaPam' | 'liveRecorder',
    tabId: string,
    scopeKey?: string
  ): boolean => {
    if (scopeKey && scopeKey !== 'ALL' && visibilitySettings.scopedMenuVisibility?.[scopeKey]) {
      const val = visibilitySettings.scopedMenuVisibility[scopeKey][tabId];
      if (val !== undefined) return val;
    }
    const typeVis = visibilitySettings.dashboardMenuVisibility?.[dashboardType];
    if (typeVis && typeVis[tabId] !== undefined) {
      return typeVis[tabId];
    }
    return defaultMenuVisibility[dashboardType]?.[tabId] ?? true;
  };

  return (
    <RoleContext.Provider
      value={{
        currentRole,
        setCurrentRole,
        currentUser,
        setCurrentUser,
        usersList,
        loginUser,
        logoutUser,
        updateUserCredentials,
        deleteUser,
        addUser,
        visibilitySettings,
        updateVisibilitySetting,
        updateMenuVisibility,
        isTabVisibleForPublic,
        refreshUsers
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
