const { createClient } = require('@supabase/supabase-js');

let url = "https://ktihcjfxxxazohimtiav.supabase.co";
let key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aWhjamZ4eHhhem9oaW10aWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjA1ODYsImV4cCI6MjEwMDgzNjU4Nn0.T9C9Io9dBIiEPlIeLWLEHguAG--PO1US8qKDD0Dhzw4";

const supabase = createClient(url, key);

async function setupSchema() {
  console.log("Starting fresh setup of all structured tables...");

  // Seed Default Admin User
  const defaultUsers = [
    {
      full_name: "Dr. Robin Vijayan",
      email: "robin@iisertirupati.ac.in",
      role: "Admin",
      organization: "IISER Tirupati Bird Lab",
      project_scope_permissions: ["bird_lab_demo", "tst", "nilgiri"]
    },
    {
      full_name: "Project Manager",
      email: "manager@birdlab.org",
      role: "Project Manager",
      organization: "IISER Tirupati",
      project_scope_permissions: ["bird_lab_demo", "tst"]
    },
    {
      full_name: "Site Manager",
      email: "sitemanager@birdlab.org",
      role: "Site Manager",
      organization: "IISER Tirupati",
      project_scope_permissions: ["bird_lab_demo"]
    },
    {
      full_name: "Bioacoustic Researcher",
      email: "researcher@birdlab.org",
      role: "Researcher",
      organization: "IISER Tirupati",
      project_scope_permissions: ["bird_lab_demo"]
    }
  ];

  const { error: userErr } = await supabase.from('users').upsert(defaultUsers, { onConflict: 'email' });
  if (userErr) console.error("User Seed Error:", userErr);
  else console.log("✅ Seeded default users cleanly!");

  // Seed Master Registry Entries
  const registryEntries = [
    {
      id: "Test_Lab_1",
      project_type: "Live",
      project_name: "Bird_Lab_demo",
      site_name: "Inside BirdLab",
      recorder_id: "Test_Lab_1",
      status: "online",
      lat: 13.6288,
      long: 79.4192
    },
    {
      id: "str_01_cs_01",
      project_type: "PAM",
      project_name: "The Shola Trust - Lantana Project",
      site_name: "TST Site 01",
      recorder_id: "str_01_cs_01",
      status: "offline",
      lat: 11.4102,
      long: 76.6950
    }
  ];

  const { error: regErr } = await supabase.from('recorders_registry').upsert(registryEntries, { onConflict: 'id' });
  if (regErr) {
    console.log("Note: recorders_registry table needs to be created via SQL Editor if table doesn't exist yet.");
  } else {
    console.log("✅ Seeded master recorders registry cleanly!");
  }
}

setupSchema();
