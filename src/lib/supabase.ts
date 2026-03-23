import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dcqjxdxjonvfalncywfd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjcWp4ZHhqb252ZmFsbmN5d2ZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMzYxODMsImV4cCI6MjA4OTgxMjE4M30.I9MSccAUtQhHewouzgU_7lIQhsyCwqjglujsrAlTPxM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type AppRole = 'admin' | 'pilot' | 'viewer';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  image_count: number;
  area_ha: number | null;
  status: 'queued' | 'processing' | 'complete' | 'failed';
  progress: number;
  outputs: string[];
  created_at: string;
  updated_at: string;
}
