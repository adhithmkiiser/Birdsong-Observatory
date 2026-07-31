'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, PublicVisibilitySettings, User } from '@/types/database';
import { MOCK_USERS } from '@/lib/mockData';
import { supabase } from '@/lib/supabase';

interface RoleContextType {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  currentUser: User;
  setCurrentUser: (user: User) => void;
  usersList: User[];
  loginUser: (email: string, pass: string) => { success: boolean; message: string };
  logoutUser: () => void;
  updateUserCredentials: (userId: string, updates: Partial<User>) => void;
  deleteUser: (userId: string) => void;
  addUser: (user: User) => void;
  visibilitySettings: PublicVisibilitySettings;
  updateVisibilitySetting: (key: keyof PublicVisibilitySettings, val: boolean) => void;
}

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
  password: dbUser.password_hash || dbUser.password || 'pass123',
  role: dbUser.role as any,
  organization: dbUser.organization || 'IISER Tirupati Bird Lab',
  projectScopePermissions: dbUser.project_scope_permissions || [],
  isOneTimePassword: dbUser.is_one_time_password || false,
  mustChangePassword: dbUser.must_change_password || false,
  status: dbUser.status as any || 'active',
  createdAt: dbUser.created_at ? dbUser.created_at.split('T')[0] : '2026-01-15',
  lastLogin: dbUser.last_login || 'Never'
});

const mapUserToDbUser = (user: User) => ({
  id: user.id,
  full_name: user.name,
  email: user.email,
  password_hash: user.password || 'pass123',
  role: user.role,
  organization: user.organization,
  project_scope_permissions: user.projectScopePermissions || [],
  is_one_time_password: user.isOneTimePassword || false,
  must_change_password: user.mustChangePassword || false,
  status: user.status || 'active',
  created_at: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString()
});

const RoleContext = createContext<RoleContextType>({
  currentRole: 'Admin',
  setCurrentRole: () => {},
  currentUser: MOCK_USERS[0],
  setCurrentUser: () => {},
  usersList: MOCK_USERS,
  loginUser: () => ({ success: false, message: '' }),
  logoutUser: () => {},
  updateUserCredentials: () => {},
  deleteUser: () => {},
  addUser: () => {},
  visibilitySettings: defaultVisibilitySettings,
  updateVisibilitySetting: () => {},
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [usersList, setUsersList] = useState<User[]>(MOCK_USERS);
  const [currentUser, setCurrentUser] = useState<User>(MOCK_USERS[0]);
  const [currentRole, setCurrentRoleState] = useState<UserRole>(MOCK_USERS[0].role);
  const [visibilitySettings, setVisibilitySettings] = useState<PublicVisibilitySettings>(defaultVisibilitySettings);

  useEffect(() => {
    async function loadUsers() {
      try {
        const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: true });
        if (!error && data && data.length > 0) {
          const mappedUsers = data.map(mapDbUserToUser);
          setUsersList(mappedUsers);
          // Sync current session role with loaded db user if match exists
          const match = mappedUsers.find(u => u.email.toLowerCase() === currentUser.email.toLowerCase());
          if (match) {
            setCurrentUser(match);
            setCurrentRoleState(match.role);
          }
        }
      } catch (e) {
        console.error('Failed to load users from database:', e);
      }
    }
    loadUsers();
  }, []);

  const setCurrentRole = (role: UserRole) => {
    setCurrentRoleState(role);
    // Sync current user role preview
    setCurrentUser(prev => ({ ...prev, role }));
  };

  const loginUser = (email: string, pass: string) => {
    const found = usersList.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (!found) {
      return { success: false, message: 'No account found with this email address.' };
    }
    if (found.password && found.password !== pass) {
      return { success: false, message: 'Incorrect password. Please verify your credentials.' };
    }
    if (found.status !== 'active') {
      return { success: false, message: 'This account is currently suspended or inactive.' };
    }

    const updated = { ...found, lastLogin: 'Just now' };
    setCurrentUser(updated);
    setCurrentRoleState(updated.role);

    // Update in user list
    setUsersList(prev => prev.map(u => u.id === found.id ? updated : u));
    
    // Save last login time to DB
    supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', found.id).then();
    
    return { success: true, message: `Welcome back, ${found.name}!` };
  };

  const logoutUser = () => {
    const publicUser = usersList.find(u => u.role === 'Public') || MOCK_USERS[3] || {
      id: 'usr-public',
      name: 'Public Guest',
      email: 'public@birdlab.in',
      role: 'Public',
      organization: 'Public Network',
      status: 'active',
      createdAt: '2026-01-15'
    };
    setCurrentUser(publicUser);
    setCurrentRoleState('Public');
  };

  const updateUserCredentials = async (userId: string, updates: Partial<User>) => {
    setUsersList(prev => prev.map(u => {
      if (u.id === userId) {
        const updated = { ...u, ...updates };
        // If editing current logged in user, update active session
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
    if (updates.name !== undefined) {
      dbUpdates.full_name = updates.name;
    }
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.password !== undefined) dbUpdates.password_hash = updates.password;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.organization !== undefined) dbUpdates.organization = updates.organization;
    if (updates.assignedProjectType !== undefined) dbUpdates.assigned_project_type = updates.assignedProjectType;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.lastLogin !== undefined && updates.lastLogin !== 'Never') {
      dbUpdates.last_login = updates.lastLogin;
    }

    try {
      const { error } = await supabase.from('users').update(dbUpdates).eq('id', userId);
      if (error) {
        console.error('Supabase error updating user:', error);
        alert('Error updating user in database: ' + error.message);
      }
    } catch (e) {
      console.error('Supabase error updating user:', e);
    }
  };

  const deleteUser = async (userId: string) => {
    setUsersList(prev => prev.filter(u => u.id !== userId));
    try {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) {
        console.error('Supabase error deleting user:', error);
        alert('Error deleting user in database: ' + error.message);
      }
    } catch (e) {
      console.error('Supabase error deleting user:', e);
    }
  };

  const addUser = async (newUser: User) => {
    setUsersList(prev => [newUser, ...prev]);
    try {
      const dbUser = mapUserToDbUser(newUser);
      const { error } = await supabase.from('users').insert([dbUser]);
      if (error) {
        console.error('Supabase error adding user:', error);
        alert('Error adding user in database: ' + error.message);
      }
    } catch (e) {
      console.error('Supabase error adding user:', e);
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
        updateVisibilitySetting
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
