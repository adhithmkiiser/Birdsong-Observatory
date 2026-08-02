import os
import re
import sys
import csv
import glob
from datetime import datetime, timedelta
from supabase import create_client, Client

# Configurations
SUPABASE_URL = "https://ktihcjfxxxazohimtiav.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aWhjamZ4eHhhem9oaW10aWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjA1ODYsImV4cCI6MjEwMDgzNjU4Nn0.T9C9Io9dBIiEPlIeLWLEHguAG--PO1US8qKDD0Dhzw4"

def normalize_site_code(name: str) -> str:
    return re.sub(r'[-\s]+', '_', name.strip().lower()).upper()

def compile_and_upload(folder_path, project_id, project_type='PAM'):
    print("=" * 60)
    print(f"🚀 STARTING BIRDNET SELECTION TABLES COMPILER FOR PROJECT: {project_id} (type: {project_type})")
    print(f"📂 Folder path: {folder_path}")
    print("=" * 60)

    # Validate and resolve target table
    is_lantana = project_type.strip().lower() == 'lantana'
    target_table = 'lantana_detections' if is_lantana else 'pam_detections'

    # Initialize Supabase Client
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Fetch project metadata from Supabase
    try:
        proj_res = supabase.table('projects').select('id, name, project_type').eq('id', project_id).limit(1).execute()
        project_row = proj_res.data[0] if proj_res.data else None
        project_name = project_row['name'] if project_row else project_id
        if project_row:
            is_lantana = project_row['project_type'].strip().lower() == 'lantana'
            target_table = 'lantana_detections' if is_lantana else 'pam_detections'
    except Exception as e:
        print(f"⚠️ Could not fetch project metadata, using defaults: {e}")
        project_name = project_id

    # Find all selection table and BirdNET CSV files
    txt_pattern = os.path.join(folder_path, "*.txt")
    csv_pattern = os.path.join(folder_path, "*.csv")
    files = glob.glob(txt_pattern) + glob.glob(csv_pattern)
    
    if not files:
        print("❌ No selection table (.txt) or BirdNET results (.csv) files found in the specified folder!")
        return

    print(f"📦 Found {len(files)} files to compile...")

    all_detections = []
    
    for idx, filepath in enumerate(files, 1):
        filename = os.path.basename(filepath)
        
        if filename.lower().endswith('.csv'):
            # Derive site/recorder from the folder structure, e.g. .../ATR/LC_01/file.csv
            recorder_code = normalize_site_code(os.path.basename(folder_path) or 'REC_01')
            site_code = normalize_site_code(os.path.basename(os.path.dirname(folder_path)) or 'SITE_01')
        else:
            # Parse site/recorder code from filename (e.g. A11-02_20260124_060000.BirdNET.selection.table.txt)
            site_code = "SITE_01"
            recorder_code = "REC_01"
            parts = filename.split('_')
            if len(parts) > 1:
                site_code = normalize_site_code(parts[0])
            # Best-effort recorder extraction from second token if present (e.g. A11_02_20260124...)
            if len(parts) > 2:
                recorder_code = normalize_site_code(parts[1])
            
        print(f"🔄 [{idx}/{len(files)}] Parsing file: {filename} (Site: {site_code}, Recorder: {recorder_code})")
        
        try:
            if filename.lower().endswith('.csv'):
                # Parse BirdNET.results.csv (comma-separated)
                with open(filepath, 'r', encoding='utf-8', newline='') as f:
                    reader = csv.DictReader(f)
                    if not reader.fieldnames:
                        continue
                    fieldnames = [h.strip() for h in reader.fieldnames]
                    try:
                        common_name_idx = fieldnames.index('Common name')
                        confidence_idx = fieldnames.index('Confidence')
                    except ValueError:
                        print(f"  ⚠️ Warning: Skipping {filename} - missing 'Common name' or 'Confidence' columns.")
                        continue
                    sci_name_idx = fieldnames.index('Scientific name') if 'Scientific name' in fieldnames else -1
                    start_idx = fieldnames.index('Start (s)') if 'Start (s)' in fieldnames else -1
                    end_idx = fieldnames.index('End (s)') if 'End (s)' in fieldnames else -1
                    file_idx = fieldnames.index('File') if 'File' in fieldnames else -1

                    for row in reader:
                        values = list(row.values())
                        common_name = values[common_name_idx].strip() if common_name_idx < len(values) else ''
                        try:
                            confidence = float(values[confidence_idx])
                        except (ValueError, IndexError):
                            continue
                        if not common_name or confidence <= 0.0:
                            continue
                        scientific_name = values[sci_name_idx].strip() if sci_name_idx >= 0 and sci_name_idx < len(values) and values[sci_name_idx] else common_name
                        start_s = float(values[start_idx]) if start_idx >= 0 and start_idx < len(values) and values[start_idx] else 0.0
                        end_s = float(values[end_idx]) if end_idx >= 0 and end_idx < len(values) and values[end_idx] else (start_s + 3.0)
                        file_value = values[file_idx].strip() if file_idx >= 0 and file_idx < len(values) and values[file_idx] else filename

                        # Extract base timestamp from audio path or filename, then add detection offset
                        date_match = re.search(r'(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})', file_value)
                        if not date_match:
                            date_match = re.search(r'(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})', filename)
                        if not date_match:
                            print(f"  ⚠️ Warning: Skipping row in {filename} - could not parse YYYYMMDD_HHMMSS timestamp from '{file_value}'.")
                            continue
                        try:
                            y, m, d, hh, mm, ss = date_match.groups()
                            timestamp = datetime(int(y), int(m), int(d), int(hh), int(mm), int(ss))
                            timestamp += timedelta(seconds=start_s)
                        except Exception as e:
                            print(f"  ⚠️ Warning: Skipping row in {filename} - invalid timestamp values: {e}")
                            continue

                        if is_lantana:
                            all_detections.append({
                                "project_id": project_id,
                                "project_name": project_name,
                                "site_name": site_code,
                                "recorder_id": recorder_code,
                                "recorder_name": recorder_code,
                                "common_name": common_name,
                                "scientific_name": scientific_name,
                                "threshold": confidence,
                                "date": timestamp.strftime("%Y-%m-%d"),
                                "time": timestamp.strftime("%H:%M:%S"),
                                "start_time": start_s,
                                "end_time": end_s,
                                "file_name": os.path.basename(file_value)
                            })
                        else:
                            all_detections.append({
                                "project_name": project_name,
                                "site_name": site_code,
                                "recorder_name": recorder_code,
                                "common_name": common_name,
                                "scientific_name": scientific_name,
                                "confidence": confidence,
                                "date": timestamp.strftime("%Y-%m-%d"),
                                "time": timestamp.strftime("%H:%M:%S"),
                                "start_time": start_s,
                                "end_time": end_s,
                                "file_name": os.path.basename(file_value)
                            })
            else:
                # Parse tab-separated selection table (.txt)
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

                # Extract the base timestamp once from the selection table's filename
                base_timestamp = None
                date_match = re.search(r'(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})', filename)
                if date_match:
                    try:
                        y, m, d, hh, mm, ss = date_match.groups()
                        base_timestamp = datetime(int(y), int(m), int(d), int(hh), int(mm), int(ss))
                    except Exception as e:
                        print(f"  ⚠️ Warning: Skipping {filename} - invalid timestamp values: {e}")
                        continue
                if base_timestamp is None:
                    print(f"  ⚠️ Warning: Skipping {filename} - could not parse YYYYMMDD_HHMMSS timestamp from filename.")
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

                    timestamp = base_timestamp
                    
                    if is_lantana:
                        all_detections.append({
                            "project_id": project_id,
                            "project_name": project_name,
                            "site_name": site_code,
                            "recorder_id": recorder_code,
                            "recorder_name": recorder_code,
                            "common_name": common_name,
                            "scientific_name": common_name,
                            "threshold": confidence,
                            "date": timestamp.strftime("%Y-%m-%d"),
                            "time": timestamp.strftime("%H:%M:%S"),
                            "start_time": 0.0,
                            "end_time": 3.0,
                            "file_name": filename
                        })
                    else:
                        all_detections.append({
                            "project_name": project_name,
                            "site_name": site_code,
                            "recorder_name": recorder_code,
                            "common_name": common_name,
                            "scientific_name": common_name,
                            "confidence": confidence,
                            "date": timestamp.strftime("%Y-%m-%d"),
                            "time": timestamp.strftime("%H:%M:%S"),
                            "start_time": 0.0,
                            "end_time": 3.0,
                            "file_name": filename
                        })
        except Exception as e:
            print(f"  ❌ Error parsing {filename}: {e}")

    total_records = len(all_detections)
    print(f"\n📊 Compilation finished! Total detections compiled: {total_records}")
    if total_records == 0:
        return

    # Bulk insert in chunks of 500
    print(f"📤 Uploading detections to Supabase table: {target_table} ...")
    chunk_size = 500
    inserted = 0
    
    for i in range(0, total_records, chunk_size):
        chunk = all_detections[i:i + chunk_size]
        try:
            res = supabase.table(target_table).insert(chunk).execute()
            inserted += len(chunk)
            # Display progress bar in terminal
            percent = int((inserted / total_records) * 100)
            bar = "=" * (percent // 2) + ">" + "." * (50 - percent // 2)
            sys.stdout.write(f"\r[{bar}] {percent}% Uploaded ({inserted}/{total_records} rows)")
            sys.stdout.flush()
        except Exception as e:
            print(f"\n❌ Error uploading chunk starting at index {i}: {e}")
            break

    print(f"\n\n✅ SUCCESS! Uploaded {inserted} detections successfully to {target_table}!")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python pam_data_compiler.py <folder_path> <project_id> [project_type]")
        print("Example: python pam_data_compiler.py \"C:\\Recordings\" \"nilgiri\" \"PAM\"")
        print("Example: python pam_data_compiler.py \"C:\\Recordings\" \"lantana-shola\" \"Lantana\"")
    else:
        project_type = sys.argv[3] if len(sys.argv) >= 4 else 'PAM'
        compile_and_upload(sys.argv[1], sys.argv[2], project_type)
