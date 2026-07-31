import json
import pandas as pd

xlsx_path = r'D:\IISER-T\Dashboard\Location\species_master.xlsx'
df = pd.read_excel(xlsx_path)

df.columns = [c.strip().lower() for c in df.columns]

def get(r, col):
    v = r.get(col, '')
    if pd.isna(v):
        return ''
    return str(v).strip()

by_scientific = {}
by_common = {}

for _, row in df.iterrows():
    sci = get(row, 'scientific name')
    comm = get(row, 'common name')
    record = {
        'common_name': comm,
        'scientific_name': sci,
        'endemic_status': get(row, 'endemic status'),
        'habitat': get(row, 'preferred habitat'),
        'guild': get(row, 'guild'),
        'vocal_activity': get(row, 'vocal activity'),
        'iucn_status': get(row, 'iucn status'),
        'foraging_stratum': get(row, 'foraging stratum'),
        'indicator_group': get(row, 'indicator group'),
        'image_url': get(row, 'image link'),
        'audio_url': get(row, 'audio link')
    }
    if sci:
        by_scientific[sci.lower()] = record
    if comm:
        by_common[comm.lower()] = record

output = {
    'byScientific': by_scientific,
    'byCommon': by_common
}

with open(r'D:\Live_Recorder\public\species_data.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f'Wrote {len(by_scientific)} scientific + {len(by_common)} common species entries.')
