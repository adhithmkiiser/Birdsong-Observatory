'use client';

import React, { createContext, useContext, useState } from 'react';
import { UserRole, PublicVisibilitySettings, User } from '@/types/database';
import { MOCK_USERS } from '@/lib/mockData';

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
    return { success: true, message: `Welcome back, ${found.name}!` };
  };

  const logoutUser = () => {
    const publicUser = usersList.find(u => u.role === 'Public') || MOCK_USERS[3];
    setCurrentUser(publicUser);
    setCurrentRoleState('Public');
  };

  const updateUserCredentials = (userId: string, updates: Partial<User>) => {
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
  };

  const deleteUser = (userId: string) => {
    setUsersList(prev => prev.filter(u => u.id !== userId));
  };

  const addUser = (newUser: User) => {
    setUsersList(prev => [newUser, ...prev]);
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
