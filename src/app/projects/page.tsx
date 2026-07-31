'use client';

import React, { useState, useEffect } from 'react';
import { 
  FolderKanban, 
  Cpu, 
  Bird, 
  Radio, 
  Building, 
  Calendar, 
  Plus, 
  X, 
  Eye, 
  CheckCircle2, 
  Users, 
  Activity, 
  Globe, 
  Lock,
  Trash2,
  Edit2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/components/layout/RoleContext';

export default function ProjectsPage() {
  const { currentRole, currentUser } = useRole();
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // New Project Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [organization, setOrganization] = useState('IISER Tirupati Bird Lab');
  const [managerName, setManagerName] = useState(currentUser?.name || '');
  const [publicVisible, setPublicVisible] = useState(true);
  const [createdSuccessMsg, setCreatedSuccessMsg] = useState('');

  const canCreate = currentRole === 'Admin';

  useEffect(() => {
    async function loadProjectsWithCounts() {
      const [{ data: projs }, { data: recs }, { data: dets }] = await Promise.all([
        supabase.from('projects').select('*').eq('project_type', 'Live').order('created_at', { ascending: false }),
        supabase.from('recorders_registry').select('project_name').eq('project_type', 'Live'),
        supabase.from('live_detections').select('project_name, common_name, scientific_name, recorder_id, timestamp')
      ]);

      const projects = projs || [];
      const projectNames = new Set(projects.map(p => p.name));

      const recordersByProject: Record<string, number> = {};
      (recs || []).forEach(r => {
        if (projectNames.has(r.project_name)) {
          recordersByProject[r.project_name] = (recordersByProject[r.project_name] || 0) + 1;
        }
      });

      const detsByProject: Record<string, any[]> = {};
      (dets || []).forEach(d => {
        if (projectNames.has(d.project_name)) {
          (detsByProject[d.project_name] ||= []).push(d);
        }
      });

      const withCounts = projects.map(p => {
        const raw = detsByProject[p.name] || [];
        const seen = new Set<string>();
        const unique = raw.filter((d: any) => {
          const key = `${d.recorder_id}|${d.timestamp}|${d.common_name}|${d.scientific_name}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const species = new Set(unique.map(d => d.common_name || d.scientific_name).filter(Boolean));
        return {
          ...p,
          stations_count: recordersByProject[p.name] || 0,
          total_detections: unique.length,
          species_count: species.size
        };
      });

      setProjectsList(withCounts);
      setLoading(false);
    }
    loadProjectsWithCounts();
  }, []);

  const [editingProj, setEditingProj] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editOrg, setEditOrg] = useState('');
  const [editManager, setEditManager] = useState('');
  const [editPublic, setEditPublic] = useState(true);
  const [editImage, setEditImage] = useState('');

  const [imageUrl, setImageUrl] = useState('');

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const newProj = {
      id: `prj-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      organization,
      manager_name: managerName,
      public_visible: publicVisible,
      project_type: 'PAM',
      species_count: 0,
      total_detections: 0,
      stations_count: 0,
      image_url: imageUrl,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('projects').insert([newProj]).select().single();
    if (error) {
      console.error('Supabase error inserting project:', error);
      alert('Error creating project: ' + error.message);
      return;
    }

    if (data) {
      setProjectsList(prev => [data, ...prev]);
      setCreatedSuccessMsg('Project created successfully!');
      setTimeout(() => {
        setIsCreateOpen(false);
        setCreatedSuccessMsg('');
        setName('');
        setDescription('');
        setImageUrl('');
      }, 800);
    }
  };

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProj) return;

    const { error } = await supabase.from('projects').update({
      name: editName,
      description: editDesc,
      organization: editOrg,
      manager_name: editManager,
      public_visible: editPublic,
      image_url: editImage
    }).eq('id', editingProj.id);

    if (error) {
      alert('Error updating project: ' + error.message);
      return;
    }

    setProjectsList(prev => prev.map(p => p.id === editingProj.id ? {
      ...p,
      name: editName,
      description: editDesc,
      organization: editOrg,
      manager_name: editManager,
      public_visible: editPublic,
      image_url: editImage
    } : p));

    setEditingProj(null);
    alert('Project updated successfully!');
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    await supabase.from('projects').delete().eq('id', id);
    setProjectsList(prev => prev.filter(p => p.id !== id));
    if (selectedProject?.id === id) setSelectedProject(null);
  };


  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <FolderKanban className="w-5 h-5 text-indigo-600" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Active Research Projects & Transects</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Multi-site bioacoustic monitoring programs funded by IISER Tirupati and biodiversity conservation agencies.
          </p>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="p-6 rounded-3xl bg-white border border-slate-200 h-64 animate-pulse" />
          ))
        ) : projectsList.length === 0 ? (
          <div className="col-span-3 py-16 flex flex-col items-center gap-3 text-slate-500">
            <FolderKanban className="w-10 h-10 text-slate-300" />
            <div className="font-black text-sm text-slate-900">No Projects Found</div>
            <p className="text-xs text-slate-500 max-w-sm text-center">Manage research projects via the Admin Consoles.</p>
          </div>
        ) : projectsList.map((proj) => (
          <div key={proj.id} className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {proj.organization}
                </span>
                <div className="flex items-center gap-1.5">
                  {proj.public_visible ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100 flex items-center gap-1">
                      <Globe className="w-3 h-3" /> Public
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Internal
                    </span>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">{proj.name}</h3>
                <p className="text-xs text-slate-500 line-clamp-2 mt-1 font-medium leading-relaxed">
                  {proj.description || 'Bioacoustic monitoring project.'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="text-[10px] text-slate-400 font-bold">Nodes</div>
                  <div className="font-black text-slate-900">{proj.stations_count ?? 0}</div>
                </div>
                <div className="p-2 rounded-lg bg-amber-50/50 border border-amber-100">
                  <div className="text-[10px] text-amber-700 font-bold">Species</div>
                  <div className="font-black text-amber-900">{proj.species_count ?? 0}</div>
                </div>
                <div className="p-2 rounded-lg bg-emerald-50/50 border border-emerald-100">
                  <div className="text-[10px] text-emerald-700 font-bold">Detections</div>
                  <div className="font-black text-emerald-900">{(proj.total_detections ?? 0).toLocaleString()}</div>
                </div>
              </div>

              <div className="pt-1">
                <button
                  onClick={() => setSelectedProject(proj)}
                  className="w-full py-2.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center gap-1.5 transition shadow-2xs"
                >
                  <Eye className="w-3.5 h-3.5" /> View Details
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* View Project Details Modal */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col justify-between">
            <div className="p-6 bg-gradient-to-r from-[#022c22] via-[#0f172a] to-[#1e1b4b] text-white relative">
              <button
                onClick={() => setSelectedProject(null)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/30">
                {selectedProject.organization}
              </span>
              <h2 className="text-lg font-black tracking-tight mt-1">{selectedProject.name}</h2>
              <p className="text-xs text-slate-300 font-medium">{selectedProject.description}</p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-bold">Manager</div>
                  <div className="font-extrabold text-slate-900 truncate">{selectedProject.manager_name}</div>
                </div>
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                  <div className="text-[10px] text-amber-700 font-bold">Total Species</div>
                  <div className="font-black text-amber-900 text-sm">{selectedProject.species_count}</div>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <div className="text-[10px] text-emerald-700 font-bold">Total Detections</div>
                  <div className="font-black text-emerald-900 text-sm">{selectedProject.total_detections.toLocaleString()}</div>
                </div>
              </div>

              <div>
                <h4 className="font-extrabold text-slate-900 mb-2">Assigned Recording Nodes</h4>
                <div className="p-3 text-center text-slate-400 font-medium text-xs">
                  {selectedProject.stations_count ?? 0} node(s) registered. View the Stations page for telemetry details.
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                <button
                  onClick={() => setSelectedProject(null)}
                  className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col justify-between">
            <div className="p-6 bg-gradient-to-r from-[#022c22] via-[#0f172a] to-[#1e1b4b] text-white relative">
              <button
                onClick={() => setIsCreateOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
              <h2 className="text-lg font-black tracking-tight">Create New Research Project</h2>
              <p className="text-xs text-slate-300 font-medium">Initialize a new acoustic monitoring program.</p>
            </div>

            <form onSubmit={handleCreateProject} className="p-6 space-y-4 text-xs">
              {createdSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {createdSuccessMsg}
                </div>
              )}

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Nilgiri Shola Avian Transect"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Description</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Outline research scope and geographic focus..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Lead Manager Name</label>
                <input
                  type="text"
                  required
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Project Image URL (Optional)</label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/... or /Shola_Trust.png"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="font-extrabold text-slate-900">Public Visibility</div>
                  <div className="text-[10px] text-slate-500">Allow public visitors to view project data</div>
                </div>
                <input
                  type="checkbox"
                  checked={publicVisible}
                  onChange={(e) => setPublicVisible(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-md shadow-indigo-600/20"
                >
                  Save Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editingProj && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col justify-between">
            <div className="p-6 bg-gradient-to-r from-[#022c22] via-[#0f172a] to-[#1e1b4b] text-white relative">
              <button
                onClick={() => setEditingProj(null)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
              <h2 className="text-lg font-black tracking-tight">Edit Project: {editingProj.name}</h2>
              <p className="text-xs text-slate-300 font-medium">Modify existing project details and images.</p>
            </div>

            <form onSubmit={handleEditProject} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Description</label>
                <textarea
                  required
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Organization / Collaboration</label>
                <input
                  type="text"
                  required
                  value={editOrg}
                  onChange={(e) => setEditOrg(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Lead Manager Name</label>
                <input
                  type="text"
                  required
                  value={editManager}
                  onChange={(e) => setEditManager(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Project Image URL (Optional)</label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/... or /Shola_Trust.png"
                  value={editImage}
                  onChange={(e) => setEditImage(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="font-extrabold text-slate-900">Public Visibility</div>
                  <div className="text-[10px] text-slate-500">Allow public visitors to view project data</div>
                </div>
                <input
                  type="checkbox"
                  checked={editPublic}
                  onChange={(e) => setEditPublic(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProj(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-md shadow-indigo-600/20"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
