import pandas as pd
import json

df = pd.read_excel(r'D:\IISER-T\Dashboard\Location\species_master.xlsx')
species = []

iucn_map = {
    'LC': 'Least Concern',
    'NT': 'Near Threatened',
    'VU': 'Vulnerable',
    'EN': 'Endangered',
    'CR': 'Critically Endangered',
    'DD': 'Data Deficient'
}

for idx, row in df.iterrows():
    c_name = str(row.get('common name', '')).strip()
    s_name = str(row.get('scientific name', '')).strip()
    if not c_name or c_name == 'nan':
        continue

    iucn_code = str(row.get('iucn status', 'LC')).strip().upper()
    iucn_status = iucn_map.get(iucn_code, 'Least Concern')

    img = str(row.get('image link', '')).strip()
    if not img or img == 'nan':
        img = 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?q=80&w=800&auto=format&fit=crop'

    ind_grp = str(row.get('indicator group', '')).strip()
    if not ind_grp or ind_grp == 'nan':
        ind_grp = 'General'

    spc = {
        'id': f'spc-{idx+1:03d}',
        'common_name': c_name,
        'scientific_name': s_name,
        'endemic_status': str(row.get('endemic status', 'No')).strip(),
        'habitat': str(row.get('preferred habitat', '')).strip(),
        'guild': str(row.get('guild', '')).strip(),
        'vocal_activity': str(row.get('vocal activity', '')).strip(),
        'iucn_status': iucn_status,
        'foraging_stratum': str(row.get('foraging stratum', '')).strip(),
        'indicator_group': ind_grp,
        'birdnet_label': s_name.replace(' ', '_'),
        'image_url': img,
        'detections_count': max(150, 15000 - idx * 420)
    }
    species.append(spc)

ts_content = f"""export interface MasterSpecies {{
  id: string;
  common_name: string;
  scientific_name: string;
  endemic_status: string;
  habitat: string;
  guild: string;
  vocal_activity: string;
  iucn_status: 'Least Concern' | 'Near Threatened' | 'Vulnerable' | 'Endangered' | 'Critically Endangered' | 'Data Deficient';
  foraging_stratum: string;
  indicator_group: string;
  birdnet_label: string;
  image_url: string;
  detections_count: number;
}}

export const SPECIES_MASTER_LIST: MasterSpecies[] = {json.dumps(species, indent=2)};
"""

with open(r'd:\Live_Recorder\src\lib\speciesMasterData.ts', 'w', encoding='utf-8') as f:
    f.write(ts_content)

print(f"Successfully exported {len(species)} species records to speciesMasterData.ts!")
