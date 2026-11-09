import { supabaseAdmin } from './supabaseAdmin';

export interface StationCodeMatch {
  prefix: string;
  groupNum: number;
  subNum: number;
  canonical: string;
  paddedCanonical: string;
  semiPadded: string;
  displayCode: string;
}

export function normalizeStationCode(str?: string | null): StationCodeMatch | null {
  if (!str) return null;
  const s = String(str).trim();
  // Match code patterns like A11_01, A11_1, (A11_1), A03_01, B10_1, etc.
  const m = s.match(/([A-Za-z]+)0*(\d+)[_-]0*(\d+)/);
  if (m) {
    const prefix = m[1].toUpperCase();
    const groupNum = parseInt(m[2], 10);
    const subNum = parseInt(m[3], 10);
    return {
      prefix,
      groupNum,
      subNum,
      canonical: `${prefix}${groupNum}_${subNum}`,
      paddedCanonical: `${prefix}${String(groupNum).padStart(2, '0')}_${String(subNum).padStart(2, '0')}`,
      semiPadded: `${prefix}${groupNum}_${String(subNum).padStart(2, '0')}`,
      displayCode: `(${prefix}${groupNum}_${subNum})`
    };
  }
  return null;
}

export function resolveRecorderAliases(recorderId?: string | null): string[] {
  if (!recorderId || recorderId === 'All' || recorderId === 'ALL_RECORDERS') return [];
  const raw = String(recorderId).trim();
  const set = new Set<string>([raw, raw.toLowerCase(), raw.toUpperCase()]);

  // If station code e.g. A11_1 or A11_01 or (A11_1)
  const code = normalizeStationCode(raw);
  if (code) {
    set.add(code.canonical);
    set.add(code.paddedCanonical);
    set.add(code.semiPadded);
    set.add(code.displayCode);
    set.add(`(${code.canonical})`);
    set.add(`(${code.paddedCanonical})`);
  }

  // If REC_01 or Rec_1 or LC_01
  const recMatch = raw.match(/^([A-Za-z]+)[_-]?0*(\d+)$/);
  if (recMatch) {
    const p = recMatch[1];
    const n = parseInt(recMatch[2], 10);
    const pad = String(n).padStart(2, '0');
    set.add(`${p}_${n}`);
    set.add(`${p}_${pad}`);
    set.add(`${p.toUpperCase()}_${n}`);
    set.add(`${p.toUpperCase()}_${pad}`);
    set.add(`Rec_${pad}`);
    set.add(`REC_${pad}`);
    set.add(`Rec_${n}`);
    set.add(`REC_${n}`);
  }

  return Array.from(set).filter(Boolean);
}

export async function resolveSiteEntities(params: {
  siteName?: string | null;
  siteId?: string | null;
  projectId?: string | null;
}) {
  const { siteName, siteId, projectId } = params;
  const inputStr = (siteName || siteId || '').trim();
  const normCode = normalizeStationCode(siteName) || normalizeStationCode(siteId);

  const cleanInput = inputStr.toLowerCase();
  const cleanNoPrefix = cleanInput.replace(/^(nilgiri|nbr|tst_lantana|custom)_/i, '');
  const cleanNoParens = cleanNoPrefix.replace(/[()]/g, '');

  const candidateNames = new Set<string>();
  if (siteName) candidateNames.add(siteName);
  if (siteId) candidateNames.add(siteId);

  if (normCode) {
    candidateNames.add(normCode.canonical);
    candidateNames.add(normCode.paddedCanonical);
    candidateNames.add(normCode.semiPadded);
    candidateNames.add(normCode.displayCode);
    candidateNames.add(`(${normCode.canonical})`);
    candidateNames.add(`(${normCode.paddedCanonical})`);
  }

  // Fetch reference lists from database
  let allSites: any[] = [];
  let allSitesNew: any[] = [];

  try {
    const [sRes, snRes] = await Promise.all([
      supabaseAdmin.from('sites').select('id, name, project_id, recorder_id'),
      supabaseAdmin.from('sites_new').select('id, name, project_id')
    ]);
    allSites = sRes.data || [];
    allSitesNew = snRes.data || [];
  } catch (err) {
    console.warn('Error querying sites in resolveSiteEntities:', err);
  }

  const matchedSitesNew: any[] = [];
  const matchedSites: any[] = [];

  // Match sites_new
  for (const sn of allSitesNew) {
    const snName = String(sn.name || '');
    const snCode = normalizeStationCode(snName);

    // If both have station codes, check canonical match
    if (normCode && snCode) {
      if (normCode.canonical === snCode.canonical) {
        matchedSitesNew.push(sn);
        candidateNames.add(snName);
        continue;
      }
    }

    // Direct name match
    const snLower = snName.toLowerCase();
    const snClean = snLower.replace(/^(nilgiri|nbr|tst_lantana|custom)_/i, '').replace(/[()]/g, '');
    if (
      snClean === cleanNoParens || 
      snLower === cleanInput || 
      (cleanNoParens.length >= 4 && (snLower.includes(cleanNoParens) || cleanNoParens.includes(snClean)))
    ) {
      matchedSitesNew.push(sn);
      candidateNames.add(snName);
    }
  }

  // Match sites
  for (const s of allSites) {
    const sName = String(s.name || '');
    const sId = String(s.id || '');
    const sCode = normalizeStationCode(sName) || normalizeStationCode(sId);

    if (normCode && sCode) {
      if (normCode.canonical === sCode.canonical) {
        matchedSites.push(s);
        candidateNames.add(sName);
        if (sId) candidateNames.add(sId);
        continue;
      }
    }

    const sLower = sName.toLowerCase();
    const sIdLower = sId.toLowerCase();
    const sClean = sLower.replace(/^(nilgiri|nbr|tst_lantana|custom)_/i, '').replace(/[()]/g, '');
    if (
      sClean === cleanNoParens || 
      sLower === cleanInput || 
      sIdLower === cleanInput ||
      sIdLower.includes(cleanNoParens) ||
      (cleanNoParens.length >= 4 && (sClean.includes(cleanNoParens) || cleanNoParens.includes(sClean)))
    ) {
      matchedSites.push(s);
      candidateNames.add(sName);
      if (sId) candidateNames.add(sId);
    }
  }

  const matchedSiteNewIds = Array.from(new Set(matchedSitesNew.map(sn => Number(sn.id)).filter(id => !isNaN(id))));

  return {
    matchedSitesNew,
    matchedSiteNewIds,
    matchedSites,
    candidateSiteNames: Array.from(candidateNames).filter(Boolean)
  };
}

