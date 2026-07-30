const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

let url = "https://ktihcjfxxxazohimtiav.supabase.co";
let key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aWhjamZ4eHhhem9oaW10aWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjA1ODYsImV4cCI6MjEwMDgzNjU4Nn0.T9C9Io9dBIiEPlIeLWLEHguAG--PO1US8qKDD0Dhzw4";

const supabase = createClient(url, key);

async function seedSpeciesEcology() {
  console.log("Seeding tst_species_ecology table in Supabase...");
  
  // Read species master json or data
  const sampleSpecies = [
    { scientific_name: 'Coracias benghalensis', common_name: 'Indian Roller', iucn_status: 'LC', guild: 'Insectivore', habitat: 'Open Woodland / Agriculture', foraging_stratum: 'Mid-canopy / Perch', endemic_status: 'Non-endemic' },
    { scientific_name: 'Acridotheres tristis', common_name: 'Common Myna', iucn_status: 'LC', guild: 'Omnivore', habitat: 'Urban / Grassland', foraging_stratum: 'Ground / Low canopy', endemic_status: 'Non-endemic' },
    { scientific_name: 'Phylloscopus nitidus', common_name: 'Green Warbler', iucn_status: 'LC', guild: 'Insectivore', habitat: 'Canopy / Shola Forest', foraging_stratum: 'High canopy', endemic_status: 'Migratory' },
    { scientific_name: 'Psilopogon viridis', common_name: 'White-cheeked Barbet', iucn_status: 'LC', guild: 'Frugivore', habitat: 'Evergreen / Shola Forest', foraging_stratum: 'High canopy', endemic_status: 'Western Ghats Endemic' },
    { scientific_name: 'Dicrurus macrocercus', common_name: 'Black Drongo', iucn_status: 'LC', guild: 'Insectivore', habitat: 'Open Habitat', foraging_stratum: 'Perch Aerial', endemic_status: 'Non-endemic' },
    { scientific_name: 'Spilornis cheela', common_name: 'Crested Serpent Eagle', iucn_status: 'LC', guild: 'Carnivore', habitat: 'Forest / Woodland', foraging_stratum: 'High canopy / Soaring', endemic_status: 'Non-endemic' },
    { scientific_name: 'Eumyias albicaudatus', common_name: 'Nilgiri Flycatcher', iucn_status: 'NT', guild: 'Insectivore', habitat: 'Shola Forest Edge', foraging_stratum: 'Understory / Mid-canopy', endemic_status: 'Western Ghats Endemic' },
    { scientific_name: 'Montecincla cachinnans', common_name: 'Nilgiri Laughingthrush', iucn_status: 'EN', guild: 'Omnivore', habitat: 'High Altitude Shola', foraging_stratum: 'Understory / Ground', endemic_status: 'Western Ghats Endemic' }
  ];

  const { data, error } = await supabase.from('tst_species_ecology').upsert(sampleSpecies, { onConflict: 'scientific_name' });
  if (error) {
    console.error("Error seeding tst_species_ecology:", error);
  } else {
    console.log("✅ Successfully seeded tst_species_ecology table in Supabase!");
  }
}

seedSpeciesEcology();
