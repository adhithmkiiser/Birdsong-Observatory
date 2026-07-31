-- Add project and site assignment arrays to the users table
alter table users
  add column if not exists assigned_projects text[] default '{}',
  add column if not exists assigned_sites text[] default '{}';
