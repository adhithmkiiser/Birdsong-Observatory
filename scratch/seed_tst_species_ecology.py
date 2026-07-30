import os
import pandas as pd
from supabase import create_client

url = "https://ktihcjfxxxazohimtiav.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aWhjamZ4eHhhem9oaW10aWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjA1ODYsImV4cCI6MjEwMDgzNjU4Nn0.T9C9Io9dBIiEPlIeLWLEHguAG--PO1US8qKDD0Dhzw4"

supabase = create_client(url, key)

excel_path = r"D:\IISER-T\Dashboard\Location\species_master.xlsx"
df = pd.read_excel(excel_path)

records = []
for idx, row in df.iterrows():
    sci = str(row['scientific name']).strip() if pd.notna(row['scientific name']) else ''
    com = str(row['common name']).strip() if pd.notna(row['common name']) else ''
    if not sci or not com:
        continue
    
    records.append({
        'scientific_name': sci,
        'common_name': com,
        'iucn_status': str(row['iucn status']).strip() if pd.notna(row['iucn status']) else 'LC',
        'guild': str(row['guild']).strip() if pd.notna(row['guild']) else 'Unknown',
        'habitat': str(row['preferred habitat']).strip() if pd.notna(row['preferred habitat']) else 'General',
        'foraging_stratum': str(row['foraging stratum']).strip() if pd.notna(row['foraging stratum']) else 'Unknown',
        'endemic_status': str(row['endemic status']).strip() if pd.notna(row['endemic status']) else 'Non-endemic'
    })

print(f"Parsed {len(records)} species ecology records from species_master.xlsx")

# Upsert into tst_species_ecology table in Supabase
for i in range(0, len(records), 50):
    batch = records[i:i+50]
    res = supabase.table('tst_species_ecology').upsert(batch, on_conflict='scientific_name').execute()
    print(f"Batch {i//50 + 1} upserted successfully!")

print("✅ Successfully seeded tst_species_ecology table in Supabase!")
