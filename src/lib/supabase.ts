// Re-export the auto-generated client to avoid multiple GoTrueClient instances
export { supabase } from '@/integrations/supabase/client';

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
  outputs_urls: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}
