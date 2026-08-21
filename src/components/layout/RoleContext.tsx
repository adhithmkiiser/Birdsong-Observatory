'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, PublicVisibilitySettings, User } from '@/types/database';
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

const defaultVisibilitySettings: PublicVisibilitySettings = {
  showUnverifiedDetections: true,
  allowAudioDownloads: true,
  showExactGPSCoordinates: true,
  showTelemetryMetrics: true,
  allowPublicReports: false,
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
  refreshUsers: async () => {},
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [usersList, setUsersList] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User>(defaultPublicUser);
  const [currentRole, setCurrentRoleState] = useState<UserRole>('Public');
  const [visibilitySettings, setVisibilitySettings] = useState<PublicVisibilitySettings>(defaultVisibilitySettings);

  const refreshUsers = async () => {
    try {
      const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: true });
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
      console.error('API error updating user:', e);
      alert('Error updating user in database: ' + e.message);
    }
  };

  const deleteUser = async (userId: string) => {
    setUsersList(prev => prev.filter(u => u.id !== userId));
    try {
      await apiFetch(`/api/db/users?id=${userId}`, { method: 'DELETE' }, currentUser);
    } catch (e: any) {
      console.error('API error deleting user:', e);
      alert('Error deleting user in database: ' + e.message);
    }
  };

  const addUser = async (newUser: User) => {
    try {
      const dbUser = mapUserToDbUser(newUser);
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

  const updateVisibilitySetting = (key: keyof PublicVisibilitySettings, val: boolean) => {
    setVisibilitySettings(prev => ({ ...prev, [key]: val }));
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
