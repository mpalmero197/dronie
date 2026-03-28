export type DroneStatus = 'idle' | 'active' | 'maintenance' | 'offline';
export type JobStatus = 'active' | 'completed' | 'aborted';

export interface Drone {
  id: string;
  name: string;
  model: string;
  serial_number: string;
  status: DroneStatus;
  battery_level: number;
  latitude: number | null;
  longitude: number | null;
  altitude: number;
  speed: number;
  heading: number;
  flight_time_minutes: number;
  stream_url: string | null;
  assigned_pilot_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  drone_id: string;
  project_id: string | null;
  pilot_id: string;
  status: JobStatus;
  mission_type: string;
  notes: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobWithDrone extends Job {
  drone?: Drone;
  project?: { id: string; name: string } | null;
  pilot_profile?: { full_name: string | null } | null;
}
