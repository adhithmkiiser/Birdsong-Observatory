'use client';

import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  CheckCircle2, 
  Search, 
  Edit2, 
  Trash2, 
  Building,
  Key,
  Database,
  Radio,
  Layers
} from 'lucide-react';
import { useRole } from '@/components/layout/RoleContext';
import { User, UserRole } from '@/types/database';

export default function UserManagementPage() {
  const { usersList, currentUser, deleteUser, updateUserCredentials, addUser } = useRole();

  const [searchQuery, setSearchQuery] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form States
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('Project Manager');
  const [formOrg, setFormOrg] = useState('IISER Tirupati Bird Lab');
  const [formProjectType, setFormProjectType] = useState<'PAM' | 'Live' | 'Both'>('Both');

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormRole(user.role);
    setFormOrg(user.organization || 'IISER Tirupati Bird Lab');
    setFormProjectType(user.assignedProjectType || 'Both');
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    updateUserCredentials(editingUser.id, {
      name: formName,
      email: formEmail,
      role: formRole,
      organization: formOrg,
      assignedProjectType: formProjectType
    });

    setEditingUser(null);
    showNotification(`User account for ${formName} updated successfully!`);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: User = {
      id: `usr-${Math.random().toString(36).substr(2, 9)}`,
      name: formName,
      email: formEmail,
      role: formRole,
      organization: formOrg,
      assignedProjectType: formProjectType,
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0],
      lastLogin: 'Never'
    };

    addUser(newUser);
    setIsCreateOpen(false);
    showNotification(`User account for ${formName} created successfully!`);
  };

  const handleDeleteUserConfirm = (userId: string) => {
    deleteUser(userId);
    setDeleteConfirmId(null);
    showNotification(`User account deleted from directory.`);
  };

  const filteredUsers = usersList.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.organization.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-16 font-sans">
      
      {/* Header Banner */}
      <div className="p-8 rounded-[28px] bg-gradient-to-r from-[#022c22] via-[#0f172a] to-[#1e1b4b] text-white shadow-xl border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-400 font-black text-xs uppercase tracking-wider">
            <Users className="w-3.5 h-3.5" />
            <span>Admin Governance Console</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
            User Accounts & Permission Assignment Directory
          </h1>
          <p className="text-slate-300 text-xs font-medium max-w-xl">
            Admin governance center to create users, edit organizations, delete accounts, and assign project access permissions (PAM Only, Live Only, or Both).
          </p>
        </div>

        <button
          onClick={() => {
            setFormName('');
            setFormEmail('');
            setFormRole('Project Manager');
            setFormOrg('IISER Tirupati Bird Lab');
            setFormProjectType('Both');
            setIsCreateOpen(true);
          }}
          className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-2 self-start md:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Create User Account</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Directory Table Container */}
      <div className="p-6 rounded-[28px] bg-white border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search user accounts or organizations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <span className="text-xs font-mono font-bold text-slate-500">
            Total Users: {filteredUsers.length}
          </span>
        </div>

        {/* User Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                <th className="pb-3 pl-2">User Name & Email</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Organization</th>
                <th className="pb-3">Assigned Permissions</th>
                <th className="pb-3 pr-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 pl-2">
                    <div className="font-extrabold text-slate-900">{u.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                  </td>
                  <td className="py-3.5">
                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase ${
                      u.role === 'Admin' ? 'bg-indigo-100 text-indigo-800' :
                      u.role === 'Project Manager' ? 'bg-emerald-100 text-emerald-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3.5 font-bold text-slate-700">{u.organization || 'IISER Tirupati'}</td>
                  <td className="py-3.5">
                    <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase bg-slate-100 text-slate-800 border border-slate-200 inline-flex items-center gap-1">
                      {u.assignedProjectType === 'PAM' ? <Database className="w-3 h-3 text-indigo-600" /> :
                       u.assignedProjectType === 'Live' ? <Radio className="w-3 h-3 text-emerald-600" /> :
                       <Layers className="w-3 h-3 text-amber-600" />}
                      <span>{u.assignedProjectType || 'Both'} Access</span>
                    </span>
                  </td>
                  <td className="py-3.5 pr-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEditClick(u)}
                        className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                        title="Edit User & Permissions"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(u.id)}
                        className="p-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white transition"
                        title="Delete User Account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User & Permissions Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-indigo-600" /> Edit User & Permissions ({editingUser.name})
            </h3>

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Role</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as UserRole)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900"
                >
                  <option value="Admin">Admin (Full Access to PAM & Live)</option>
                  <option value="Project Manager">Project Manager</option>
                  <option value="Site Manager">Site Manager</option>
                  <option value="Public">Public Visitor</option>
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Organization</label>
                <input
                  type="text"
                  value={formOrg}
                  onChange={(e) => setFormOrg(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Assigned Project Scope Permissions</label>
                <select
                  value={formProjectType}
                  onChange={(e) => setFormProjectType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900"
                >
                  <option value="Both">Both (PAM Data & Live Recorder Projects)</option>
                  <option value="PAM">PAM Only (Passive Acoustic Datasets)</option>
                  <option value="Live">Live Only (Realtime Streaming Nodes)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-black hover:bg-indigo-700 shadow-md shadow-indigo-600/20"
                >
                  Save Account Updates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-600" /> Create New User Account
            </h3>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900"
                  placeholder="e.g. Dr. Robin Vijayan"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-slate-900"
                  placeholder="name@organization.in"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Role</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as UserRole)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900"
                >
                  <option value="Admin">Admin (Full Access to PAM &amp; Live)</option>
                  <option value="Project Manager">Project Manager</option>
                  <option value="Site Manager">Site Manager</option>
                  <option value="Public">Public Visitor</option>
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Organization</label>
                <input
                  type="text"
                  value={formOrg}
                  onChange={(e) => setFormOrg(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Assigned Project Scope Permissions</label>
                <select
                  value={formProjectType}
                  onChange={(e) => setFormProjectType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900"
                >
                  <option value="Both">Both (PAM Data &amp; Live Recorder Projects)</option>
                  <option value="PAM">PAM Only (Passive Acoustic Datasets)</option>
                  <option value="Live">Live Only (Realtime Streaming Nodes)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black hover:bg-emerald-400 shadow-md shadow-emerald-500/25"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Account Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 text-center animate-in fade-in zoom-in duration-150">
            <Trash2 className="w-10 h-10 text-rose-600 mx-auto" />
            <h4 className="text-base font-black text-slate-900">Delete User Account?</h4>
            <p className="text-xs text-slate-500 font-medium">This action cannot be undone. User account access will be revoked immediately.</p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteUserConfirm(deleteConfirmId)}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-black text-xs hover:bg-rose-700"
              >
                Yes, Delete User
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
