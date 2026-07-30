const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

let url = "https://ktihcjfxxxazohimtiav.supabase.co";
let key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aWhjamZ4eHhhem9oaW10aWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjA1ODYsImV4cCI6MjEwMDgzNjU4Nn0.T9C9Io9dBIiEPlIeLWLEHguAG--PO1US8qKDD0Dhzw4";

const supabase = createClient(url, key);

async function seedAll128Species() {
  console.log("Seeding all 128 species into tst_species_ecology table in Supabase...");
  
  const speciesData = JSON.parse(fs.readFileSync('scratch/species_master.json', 'utf-8'));
  console.log(`Loaded ${speciesData.length} records.`);

  for (let i = 0; i < speciesData.length; i += 20) {
    const batch = speciesData.slice(i, i + 20);
    const { error } = await supabase.from('tst_species_ecology').upsert(batch, { onConflict: 'scientific_name' });
    if (error) {
      console.error(`Error uploading batch ${i}:`, error);
    } else {
      console.log(`Uploaded batch ${i} to ${i + batch.length}`);
    }
  }

  console.log("✅ ALL 128 SPECIES SUCCESSFULLY UPLOADED TO tst_species_ecology TABLE!");
}

seedAll128Species();
