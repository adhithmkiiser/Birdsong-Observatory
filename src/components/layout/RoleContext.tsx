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
  canManageProject: (projectIdOrName?: string) => boolean;
  canViewProject: (project: { id?: string; name?: string; title?: string; public_visible?: boolean | null; publicVisible?: boolean | null }) => boolean;
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
    triage: true,
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
  assignedProjectType: dbUser.assigned_project_type || dbUser.assignedProjectType || 'Both',
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
  canManageProject: () => false,
  canViewProject: () => true,
  refreshUsers: async () => {},
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [usersList, setUsersList] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User>(defaultPublicUser);
  const [currentRole, setCurrentRoleState] = useState<UserRole>('Public');
  const [visibilitySettings, setVisibilitySettings] = useState<PublicVisibilitySettings>(defaultVisibilitySettings);

  const refreshUsers = async () => {
    try {
      const res = await apiFetch('/api/db/users', { method: 'GET' });
      if (res?.users && Array.isArray(res.users)) {
        setUsersList(res.users.map(mapDbUserToUser));
      }
    } catch (e) {
      console.error('Failed to load users from server:', e);
    }
  };

  useEffect(() => {
    async function initSession() {
      try {
        const res = await apiFetch('/api/auth/login', { method: 'GET' });
        if (res?.authenticated && res?.user) {
          const authUser = res.user;
          setCurrentUser(authUser);
          setCurrentRoleState(authUser.role);
          if (typeof window !== 'undefined' && authUser.sessionToken) {
            localStorage.setItem('birdlab-session', JSON.stringify({
              email: authUser.email,
              token: authUser.sessionToken,
              role: authUser.role,
              name: authUser.name
            }));
          }
          if (authUser.role === 'Admin') {
            await refreshUsers();
          }
        }
      } catch {
        // No active authenticated session; remain Public guest
      }
    }
    initSession();
  }, []);

  const setCurrentRole = (role: UserRole) => {
    setCurrentRoleState(role);
    const matchingUser = usersList.find(u => u.role === role);
    if (matchingUser) {
      setCurrentUser(matchingUser);
    } else {
      setCurrentUser(prev => ({ ...prev, role }));
    }
  };

  const loginUser = async (email: string, pass: string): Promise<{ success: boolean; message: string; user?: User }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: email.trim(), password: pass })
      });
      const data = await res.json();

      if (!res.ok || !data.success || !data.user) {
        return { success: false, message: data.message || 'Invalid email or password.' };
      }

      const authUser = data.user;
      setCurrentUser(authUser);
      setCurrentRoleState(authUser.role);

      // Persist signed session token (never store raw password in localStorage)
      if (typeof window !== 'undefined') {
        localStorage.setItem('birdlab-session', JSON.stringify({
          email: authUser.email,
          token: authUser.sessionToken,
          role: authUser.role,
          name: authUser.name
        }));
      }

      if (authUser.role === 'Admin') {
        await refreshUsers();
      }

      return { success: true, message: data.message || `Welcome back, ${authUser.name}!`, user: authUser };
    } catch (err: any) {
      return { success: false, message: err.message || 'Login failed.' };
    }
  };

  const logoutUser = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('birdlab-session');
    }
    fetch('/api/auth/login', { method: 'DELETE', credentials: 'same-origin' }).catch(() => {});
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
      console.error('API error updating user:', e);
      alert('Error updating user in database: ' + e.message);
    }
  };

  const deleteUser = async (userId: string) => {
    setUsersList(prev => prev.filter(u => u.id !== userId));
    try {
      await apiFetch(`/api/db/users?id=${encodeURIComponent(userId)}`, { method: 'DELETE' }, currentUser);
    } catch (e: any) {
      console.error('API error deleting user:', e);
      alert('Error deleting user in database: ' + e.message);
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
      console.error('API error adding user:', e);
      alert('Error adding user to database: ' + e.message);
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

  // Determines whether the logged-in user has manager/admin permissions for a specific project.
  // If false, the user views that project strictly with Public permissions.
  const canManageProject = (projectIdOrName?: string): boolean => {
    if (currentRole === 'Admin') return true;
    if (currentRole !== 'Project Manager' && currentRole !== 'Site Manager') return false;

    const assignedProjs = (currentUser?.assignedProjects || []).map(p => String(p).toLowerCase().trim());
    const assignedSites = (currentUser?.assignedSites || []).map(s => String(s).toLowerCase().trim());

    if (!projectIdOrName || projectIdOrName === 'ALL' || projectIdOrName === 'ALL_PROJECTS' || projectIdOrName === 'ALL_LANTANA') {
      return assignedProjs.length > 0 || assignedSites.length > 0;
    }

    const target = String(projectIdOrName).toLowerCase().trim();
    if (assignedProjs.includes(target)) return true;

    // Also match common aliases (e.g., 'test' <-> 'test_custom', 'tst_lantana' <-> 'lantana', 'nilgiri' <-> 'studying the role of climate...')
    if ((target === 'test_custom' || target === 'test') && (assignedProjs.includes('test') || assignedProjs.includes('test_custom'))) {
      return true;
    }
    if (target.includes('lantana') && assignedProjs.some(p => p.includes('lantana'))) {
      return true;
    }
    if ((target === 'nilgiri' || target.includes('climate')) && (assignedProjs.includes('nilgiri') || assignedProjs.some(p => p.includes('climate')))) {
      return true;
    }

    // For Site Managers or Project Managers who have assignedSites:
    if (assignedSites.length > 0) {
      if (assignedSites.some(s => s.startsWith(`${target}_`))) return true;
      if (target.includes('lantana') && assignedSites.some(s => s.startsWith('atr_') || s.startsWith('str_') || s.includes('lantana'))) {
        return true;
      }
      if ((target === 'nilgiri' || target.includes('climate')) && assignedSites.some(s => s.startsWith('nilgiri_') || /^a\d{2}_/.test(s))) {
        return true;
      }
      if ((target === 'test' || target === 'test_custom') && assignedSites.some(s => s.startsWith('test_'))) {
        return true;
      }
    }

    return false;
  };

  // Determines whether a project is visible to the current viewer:
  // - If public_visible !== false (i.e. Public), everyone can see it.
  // - If public_visible === false (i.e. Private), only Admin and the assigned Project/Site Manager can see it.
  const canViewProject = (project: { id?: string; name?: string; title?: string; description?: string | null; public_visible?: boolean | null; publicVisible?: boolean | null }): boolean => {
    if (!project) return false;
    const isPrivate =
      project.public_visible === false ||
      project.publicVisible === false ||
      String(project.description || '').startsWith('<!--PRIVATE-->');
    if (!isPrivate) return true;
    if (currentRole === 'Admin') return true;
    const pId = project.id || '';
    const pName = project.name || project.title || '';
    return canManageProject(pId) || (Boolean(pName) && canManageProject(pName));
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
        canManageProject,
        canViewProject,
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
