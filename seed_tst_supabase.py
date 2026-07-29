import json
import urllib.request

SUPABASE_URL = "https://ktihcjfxxxazohimtiav.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aWhjamZ4eHhhem9oaW10aWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjA1ODYsImV4cCI6MjEwMDgzNjU4Nn0.T9C9Io9dBIiEPlIeLWLEHguAG--PO1US8qKDD0Dhzw4"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# 1. Load data.json and config.json
with open("public/tst/data.json", "r", encoding="utf-8") as f:
    data_json = json.load(f)

with open("public/tst/config.json", "r", encoding="utf-8") as f:
    config_json = json.load(f)

species_list = data_json.get("species_list", [])
species_metadata = data_json.get("species_metadata", {})
recorders = data_json.get("recorders", [])

recovery_indicators = set(config_json.get("indicator_species", {}).get("recovery", []))
lantana_indicators = set(config_json.get("indicator_species", {}).get("lantana", []))

print(f"Loaded {len(species_list)} species and {len(recorders)} recorder sites.")

# 2. Seed Sites
sites_records = []
for r in recorders:
    site_id = r.get("recorder_id")
    sites_records.append({
        "id": site_id,
        "project_id": "tst",
        "name": f"{site_id} Transect ({r.get('site_group')})",
        "elevation": "1,200m",
        "status": "Active",
        "latitude": r.get("lat", 13.58),
        "longitude": r.get("lng", 75.64),
        "habitat_type": "Lantana-Cleared (LC)" if r.get("habitat") == "LC" else "Lantana-Infested (LI)",
        "expected_files": r.get("expected_files", 48)
    })

req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/sites", data=json.dumps(sites_records).encode(), headers=headers, method="POST")
try:
    with urllib.request.urlopen(req) as resp:
        print("Sites Seeded in Supabase:", resp.status)
except Exception as e:
    print("Sites Seed Notice:", e)

# 3. Seed Species Ecology Matrix
species_records = []
for sp in species_list:
    meta = species_metadata.get(sp, {})
    sp_id = "sp-" + sp.lower().replace(" ", "-").replace("'", "")
    indicator_type = "Recovery (LC)" if sp in recovery_indicators else "Disturbance (LI)" if sp in lantana_indicators else "General"
    
    species_records.append({
        "id": sp_id,
        "common_name": sp,
        "scientific_name": meta.get("scientific", "Aves sp."),
        "birdnet_label": sp,
        "iucn_status": meta.get("iucn", "Least Concern"),
        "family": meta.get("family", "Aves"),
        "order_name": meta.get("order", "Passeriformes"),
        "foraging_guild": meta.get("guild", "Insectivore"),
        "foraging_stratum": meta.get("foraging_stratum", "Canopy"),
        "vocal_activity": meta.get("vocal_activity", "Diurnal"),
        "image_url": meta.get("image", "")
    })

# Batch upload species in chunks of 50
chunk_size = 50
for i in range(0, len(species_records), chunk_size):
    chunk = species_records[i:i+chunk_size]
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/species", data=json.dumps(chunk).encode(), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"Species Chunk {i}-{i+len(chunk)} Seeded in Supabase:", resp.status)
    except Exception as e:
        print(f"Species Chunk {i} Notice:", e)

print("Supabase Seeding Complete!")
