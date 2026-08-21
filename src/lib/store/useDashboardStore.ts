import { create } from 'zustand';

interface DashboardState {
  selectedProjectId: string;
  selectedStationId: string;
  selectedRecorderId: string;
  confidenceThreshold: number;
  selectedSpecies: string[];
  
  setProject: (id: string) => void;
  setStation: (id: string) => void;
  setRecorder: (id: string) => void;
  setConfidence: (val: number) => void;
  setSelectedSpecies: (species: string[]) => void;
  addSpecies: (sp: string) => void;
  removeSpecies: (sp: string) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  selectedProjectId: 'ALL_PROJECTS',
  selectedStationId: 'ALL_SITES',
  selectedRecorderId: 'ALL_RECORDERS',
  confidenceThreshold: 0.50,
  selectedSpecies: [],

  setProject: (id) => set({ 
    selectedProjectId: id, 
    selectedStationId: 'ALL_SITES', 
    selectedRecorderId: 'ALL_RECORDERS' 
  }),
  setStation: (id) => set({ 
    selectedStationId: id,
    selectedRecorderId: 'ALL_RECORDERS'
  }),
  setRecorder: (id) => set({ selectedRecorderId: id }),
  setConfidence: (val) => set({ confidenceThreshold: val }),
  setSelectedSpecies: (species) => set({ selectedSpecies: species }),
  addSpecies: (sp) => set((state) => ({ 
    selectedSpecies: state.selectedSpecies.includes(sp) 
      ? state.selectedSpecies 
      : [...state.selectedSpecies, sp] 
  })),
  removeSpecies: (sp) => set((state) => ({
    selectedSpecies: state.selectedSpecies.filter(s => s !== sp)
  }))
}));
