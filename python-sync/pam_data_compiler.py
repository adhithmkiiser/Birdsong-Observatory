import os
import re
import sys
import glob
from datetime import datetime
from supabase import create_client, Client

# Configurations
SUPABASE_URL = "https://ktihcjfxxxazohimtiav.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aWhjamZ4eHhhem9oaW10aWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjA1ODYsImV4cCI6MjEwMDgzNjU4Nn0.T9C9Io9dBIiEPlIeLWLEHguAG--PO1US8qKDD0Dhzw4"

def normalize_site_code(name: str) -> str:
    return re.sub(r'[-\s]+', '_', name.strip().lower()).upper()

def compile_and_upload(folder_path, project_id):
    print("=" * 60)
    print(f"🚀 STARTING BIRDNET SELECTION TABLES COMPILER FOR PROJECT: {project_id}")
    print(f"📂 Folder path: {folder_path}")
    print("=" * 60)

    # Initialize Supabase Client
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Find all selection table files
    search_pattern = os.path.join(folder_path, "*.txt")
    files = glob.glob(search_pattern)
    
    if not files:
        print("❌ No selection table (.txt) files found in the specified folder!")
        return

    print(f"📦 Found {len(files)} files to compile...")

    all_detections = []
    
    for idx, filepath in enumerate(files, 1):
        filename = os.path.basename(filepath)
        
        # Parse site code from filename (e.g. A11-02_20260124_060000.BirdNET.selection.table.txt)
        site_code = "SITE_01"
        parts = filename.split('_')
        if len(parts) > 1:
            site_code = normalize_site_code(parts[0])
            
        print(f"🔄 [{idx}/{len(files)}] Parsing file: {filename} (Site: {site_code})")
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                
            if len(lines) < 2:
                continue
                
            # Parse header
            header = lines[0].strip().split('\t')
            try:
                common_name_idx = header.index('Common Name')
                confidence_idx = header.index('Confidence')
                begin_path_idx = header.index('Begin Path') if 'Begin Path' in header else -1
            except ValueError:
                print(f"  ⚠️ Warning: Skipping {filename} - missing 'Common Name' or 'Confidence' columns.")
                continue

            for line in lines[1:]:
                cols = line.strip().split('\t')
                if len(cols) <= max(common_name_idx, confidence_idx):
                    continue
                    
                common_name = cols[common_name_idx].strip()
                try:
                    confidence = float(cols[confidence_idx])
                except ValueError:
                    continue
                    
                if not common_name or confidence <= 0.0:
                    continue
                    
                # Extract timestamp from filename
                timestamp = datetime.utcnow()
                date_match = re.search(r'(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})', filename)
                if date_match:
                    try:
                        y, m, d, hh, mm, ss = date_match.groups()
                        timestamp = datetime(int(y), int(m), int(d), int(hh), int(mm), int(ss))
                    except Exception:
                        pass
                
                all_detections.append({
                    "station_id": site_code,
                    "station_name": f"Recorder Site {site_code}",
                    "common_name": common_name,
                    "confidence": confidence,
                    "timestamp": timestamp.isoformat() + "Z",
                    "date_str": timestamp.strftime("%Y-%m-%d"),
                    "time_str": timestamp.strftime("%H:%M:%S"),
                    "duration": 3.0
                })
        except Exception as e:
            print(f"  ❌ Error parsing {filename}: {e}")

    total_records = len(all_detections)
    print(f"\n📊 Compilation finished! Total detections compiled: {total_records}")
    if total_records == 0:
        return

    # Bulk insert in chunks of 500
    print(f"📤 Uploading detections to Supabase database...")
    chunk_size = 500
    inserted = 0
    
    for i in range(0, total_records, chunk_size):
        chunk = all_detections[i:i + chunk_size]
        try:
            res = supabase.table("live_detections").insert(chunk).execute()
            inserted += len(chunk)
            # Display progress bar in terminal
            percent = int((inserted / total_records) * 100)
            bar = "=" * (percent // 2) + ">" + "." * (50 - percent // 2)
            sys.stdout.write(f"\r[{bar}] {percent}% Uploaded ({inserted}/{total_records} rows)")
            sys.stdout.flush()
        except Exception as e:
            print(f"\n❌ Error uploading chunk starting at index {i}: {e}")
            break

    print(f"\n\n✅ SUCCESS! Uploaded {inserted} detections successfully to the database!")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python pam_data_compiler.py <folder_path> <project_id>")
        print("Example: python pam_data_compiler.py \"C:\\Recordings\" \"nilgiri\"")
    else:
        compile_and_upload(sys.argv[1], sys.argv[2])
