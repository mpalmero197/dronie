export type DroneStatus = 'idle' | 'active' | 'maintenance' | 'offline';
export type JobStatus = 'active' | 'completed' | 'aborted';
export type PayloadType = 'rgb' | 'thermal' | 'multispectral' | 'lidar' | 'rgb_thermal' | 'zoom' | 'spotlight' | 'speaker' | 'sprayer' | 'cargo';
export type FlightMode =
  | 'manual' | 'gps' | 'sport' | 'cinematic' | 'tripod'
  | 'waypoint' | 'orbit' | 'follow' | 'mapping' | 'rtk_survey'
  | 'rth' | 'landing' | 'hover';
export type CommandStatus = 'queued' | 'sent' | 'acked' | 'failed' | 'cancelled';

export type DroneCommandName =
  | 'arm' | 'disarm'
  | 'takeoff' | 'land' | 'rth' | 'hover' | 'emergency_stop'
  | 'set_altitude' | 'set_heading' | 'set_speed' | 'set_position'
  | 'set_flight_mode' | 'set_geofence' | 'set_max_altitude'
  | 'gimbal_pitch' | 'gimbal_yaw' | 'zoom'
  | 'capture_photo' | 'start_recording' | 'stop_recording'
  | 'switch_payload'
  | 'mission_upload' | 'mission_start' | 'mission_pause' | 'mission_resume' | 'mission_abort'
  | 'spotlight_on' | 'spotlight_off'
  | 'speaker_tts'
  | 'parachute_deploy'
  | 'calibrate_compass' | 'calibrate_imu'
  | 'set_home';

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
  stream_mode?: 'none' | 'webrtc' | 'url' | 'upload';
  stream_demo_path?: string | null;
  assigned_pilot_id: string | null;
  created_at: string;
  updated_at: string;
  // Enterprise telemetry
  gps_satellites?: number;
  signal_strength?: number;
  link_quality?: number;
  wind_speed?: number;
  wind_direction?: number;
  temperature_c?: number | null;
  payload_type?: PayloadType;
  is_armed?: boolean;
  flight_mode?: FlightMode;
  home_latitude?: number | null;
  home_longitude?: number | null;
  geofence_radius_m?: number;
  max_altitude_m?: number;
  firmware_version?: string | null;
  rc_battery_level?: number;
  motor_count?: number;
  has_rtk?: boolean;
  has_thermal?: boolean;
  has_lidar?: boolean;
  has_parachute?: boolean;
  has_spotlight?: boolean;
  has_speaker?: boolean;
  gimbal_pitch?: number;
  gimbal_yaw?: number;
  zoom_level?: number;
  recording?: boolean;
}

export interface DroneCommand {
  id: string;
  drone_id: string;
  issued_by: string;
  command: DroneCommandName | string;
  params: Record<string, unknown> | null;
  status: CommandStatus;
  response: Record<string, unknown> | null;
  error: string | null;
  acked_at: string | null;
  created_at: string;
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
