'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bird, Search, ExternalLink, RefreshCw, TreePine } from 'lucide-react';

interface APISpecies {
  id: string;
  taxa_id: number;
  common_name: string;
  scientific_name: string;
  square_url: string;
  image_url: string;
  attribution: string;
  iucn_status: string;
  guild: string;
  habitat: string;
  foraging_stratum: string;
  vocal_activity: string;
  endemic_status: string;
}

export default function SpeciesPage() {
  const [speciesList, setSpeciesList] = useState<APISpecies[]>([]);
  const [suggestions, setSuggestions] = useState<APISpecies[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchingSuggestions, setSearchingSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch species auto-suggestions as user types
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingSuggestions(true);
      try {
        const url = `/api/species/list?q=${encodeURIComponent(searchQuery)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.species) {
          setSuggestions(data.species.slice(0, 8)); // Top 8 live suggestions
          setShowDropdown(true);
        }
      } catch (err) {
        console.error('Failed to fetch suggestions:', err);
      } finally {
        setSearchingSuggestions(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Debounce main grid search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch main species list
  const fetchAPISpecies = async (query: string = '') => {
    setLoading(true);
    try {
      const url = `/api/species/list?q=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.species) {
        setSpeciesList(data.species);
      }
    } catch (err) {
      console.error('Failed to fetch live API species:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAPISpecies(debouncedSearch);
  }, [debouncedSearch]);

  const handleSelectSuggestion = (spc: APISpecies) => {
    setSearchQuery(spc.common_name);
    setShowDropdown(false);
    setSpeciesList([spc]);
  };

  const getIUCNBadgeStyle = (status: string) => {
    const s = status.toUpperCase();
    if (s.includes('CRITICALLY') || s.includes('CR')) return 'bg-rose-600 text-white border-rose-700';
    if (s.includes('ENDANGERED') || s.includes('EN')) return 'bg-rose-500 text-white border-rose-600';
    if (s.includes('VULNERABLE') || s.includes('VU')) return 'bg-amber-500 text-white border-amber-600';
    if (s.includes('NEAR THREATENED') || s.includes('NT')) return 'bg-amber-400 text-slate-950 border-amber-500';
    return 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80';
  };

  const getEBirdCode = (scientificName: string) => {
    return scientificName.toLowerCase().replace(/\s+/g, '_');
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Premium Clean Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <Bird className="w-5 h-5 text-indigo-600" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Avian Species & Ecological Database</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Comprehensive species inventory cataloging ecological guilds, habitat strata, and IUCN conservation statuses.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchAPISpecies(debouncedSearch)}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1.5 text-xs font-bold"
            title="Refresh API Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Search Input with Auto-Suggest Dropdown */}
      <div className="relative z-40" ref={searchContainerRef}>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-4 text-xs">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search species by name (e.g., Sunbird, Drongo, Pitta, Hornbill, Woodpecker)..."
              value={searchQuery}
              onFocus={() => {
                if (suggestions.length > 0) setShowDropdown(true);
              }}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-semibold text-xs"
            />

            {searchingSuggestions && (
              <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
            )}
          </div>
        </div>

        {/* Auto-Suggest Dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50 divide-y divide-slate-100 max-h-96 overflow-y-auto">
            <div className="p-2.5 bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider flex justify-between items-center">
              <span>Species Suggestions</span>
              <span className="text-indigo-600 font-bold">{suggestions.length} Suggestions</span>
            </div>
            {suggestions.map((spc) => (
              <div
                key={spc.id}
                onClick={() => handleSelectSuggestion(spc)}
                className="p-3 hover:bg-indigo-50/60 cursor-pointer flex items-center justify-between transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-900 border border-slate-200 flex-shrink-0 shadow-2xs">
                    <img src={spc.square_url} alt={spc.common_name} className="w-full h-full object-cover group-hover:scale-110 transition duration-300" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 group-hover:text-indigo-700 transition">{spc.common_name}</h4>
                    <p className="text-[10px] italic text-slate-500 font-medium">{spc.scientific_name}</p>
                  </div>
                </div>

                <div className="text-right flex items-center gap-2">
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                    {spc.guild}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Loading Skeleton Grid */}
      {loading && speciesList.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-84 rounded-3xl bg-slate-100 animate-pulse"></div>
          ))}
        </div>
      ) : (
        /* Species Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {speciesList.map((spc) => (
            <div key={spc.id} className="premium-card rounded-3xl overflow-hidden flex flex-col justify-between group">
              <div>
                {/* Photo Banner */}
                <div className="h-56 relative bg-slate-950 overflow-hidden">
                  <img
                    src={spc.image_url}
                    alt={spc.common_name}
                    className="w-full h-full object-cover group-hover:scale-110 transition duration-700 ease-out"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?q=80&w=800&auto=format&fit=crop';
                    }}
                  />
                  <div className="absolute top-3.5 right-3.5 flex items-center gap-2">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-xl border shadow-md backdrop-blur-md ${getIUCNBadgeStyle(spc.iucn_status)}`}>
                      {spc.iucn_status}
                    </span>
                    {spc.endemic_status === 'Yes' && (
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-purple-600 text-white shadow-md">
                        Endemic
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 bg-slate-950/70 backdrop-blur-md px-2.5 py-1 rounded-lg text-[9px] text-slate-300 font-mono truncate">
                    {spc.attribution}
                  </div>
                </div>

                {/* Profile & Ecological Details */}
                <div className="p-5 space-y-3.5">
                  <div>
                    <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition">{spc.common_name}</h3>
                    <p className="text-xs italic text-slate-500 font-medium">{spc.scientific_name}</p>
                  </div>

                  <div className="space-y-2 text-[11px] text-slate-600 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 font-medium">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/80">
                      <span className="text-slate-500 font-bold">Ecological Guild:</span>
                      <span className="text-indigo-700 font-black bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                        {spc.guild}
                      </span>
                    </div>

                    <div className="flex items-start gap-1.5 pt-1">
                      <TreePine className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span><strong>Habitat:</strong> {spc.habitat}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[10px]">
                      <span><strong>Foraging:</strong> {spc.foraging_stratum}</span>
                      <span><strong>Vocal Activity:</strong> <strong className="text-slate-900">{spc.vocal_activity}</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* External Profile Links */}
              <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs bg-slate-50/50">
                <a
                  href={`https://www.inaturalist.org/taxa/${spc.taxa_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-600 hover:text-emerald-600 font-extrabold transition flex items-center gap-1.5 text-[11px]"
                >
                  <span>iNaturalist Profile</span> <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href={`https://ebird.org/species/${getEBirdCode(spc.scientific_name)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-600 hover:text-amber-600 font-extrabold transition flex items-center gap-1.5 text-[11px]"
                >
                  <span>eBird Profile</span> <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
