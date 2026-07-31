"""
Birdsong Observatory - Audio Upload & DB Link Script
Uploads all WAV files from Audio_files/ to Supabase 'bird-audio' bucket
and updates the audio_link column in tst_species_ecology table.
"""

import os
import sys
import io

# Force UTF-8 output to avoid Windows CP1252 encoding crashes
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SUPABASE_URL = "https://ktihcjfxxxazohimtiav.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aWhjamZ4eHhhem9oaW10aWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjA1ODYsImV4cCI6MjEwMDgzNjU4Nn0.T9C9Io9dBIiEPlIeLWLEHguAG--PO1US8qKDD0Dhzw4"

BUCKET = "bird-audio"
AUDIO_DIR = r"D:\IISER-T\Dashboard\Audio_files"

try:
    from supabase import create_client
except ImportError:
    print("Installing supabase-py...")
    os.system(f"{sys.executable} -m pip install supabase")
    from supabase import create_client

# Anon key can now upload because we added the public INSERT policy
supabase_admin = create_client(SUPABASE_URL, ANON_KEY)
supabase = create_client(SUPABASE_URL, ANON_KEY)

def slugify(name: str) -> str:
    return name.strip().replace(" ", "_").replace("'", "").replace("-", "_") + ".wav"

def get_public_url(filename: str) -> str:
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{filename}"

def upload_and_link():
    wav_files = [f for f in os.listdir(AUDIO_DIR) if f.lower().endswith(".wav")]
    print(f"\nFound {len(wav_files)} WAV files to process.\n")

    success = 0
    skip = 0
    fail = 0

    for wav_file in sorted(wav_files):
        common_name = wav_file.replace(".wav", "")
        file_path = os.path.join(AUDIO_DIR, wav_file)
        storage_filename = slugify(common_name)

        print(f"[{common_name}]")

        # --- Step 1: Upload to bird-audio bucket using service role ---
        try:
            with open(file_path, "rb") as f:
                audio_bytes = f.read()

            supabase_admin.storage.from_(BUCKET).upload(
                path=storage_filename,
                file=audio_bytes,
                file_options={"content-type": "audio/wav", "upsert": "true"}
            )
            public_url = get_public_url(storage_filename)
            print(f"  [OK] Uploaded -> {storage_filename}")
        except Exception as e:
            err_str = str(e)
            if "already exists" in err_str or "The resource already exists" in err_str or "Duplicate" in err_str:
                public_url = get_public_url(storage_filename)
                print(f"  [SKIP] Already exists in bucket -> using existing URL")
            else:
                print(f"  [FAIL] Upload error: {err_str[:120]}")
                fail += 1
                print()
                continue

        # --- Step 2: Update audio_link in tst_species_ecology ---
        try:
            result = supabase_admin.table("tst_species_ecology").update(
                {"audio_link": public_url}
            ).eq("common_name", common_name).execute()

            if result.data:
                print(f"  [OK] DB linked: tst_species_ecology['{common_name}'].audio_link updated")
                success += 1
            else:
                print(f"  [WARN] No matching row in tst_species_ecology for '{common_name}' - file uploaded but not linked")
                skip += 1
        except Exception as e:
            print(f"  [FAIL] DB update failed: {str(e)[:120]}")
            fail += 1

        print()

    print("=" * 60)
    print(f"DONE: Linked={success}  |  No-DB-row={skip}  |  Failed={fail}")
    print("=" * 60)
    print()
    print("All audio files are now publicly accessible at:")
    print(f"  {SUPABASE_URL}/storage/v1/object/public/{BUCKET}/Common_Name.wav")

if __name__ == "__main__":
    upload_and_link()
