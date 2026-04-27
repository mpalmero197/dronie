-- Drone maintenance schedule
create table public.drone_maintenance (
  id uuid primary key default gen_random_uuid(),
  drone_id uuid not null,
  task text not null,
  due_date date not null,
  cycles_left integer not null default 0,
  health_pct integer not null default 100 check (health_pct between 0 and 100),
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.drone_maintenance enable row level security;

create policy "Pilots view maintenance for their drones"
  on public.drone_maintenance
  for select
  to authenticated
  using (
    exists (
      select 1 from public.drones d
      where d.id = drone_maintenance.drone_id
        and d.assigned_pilot_id = auth.uid()
    )
  );

create policy "Admins manage all maintenance"
  on public.drone_maintenance
  for all
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

create index idx_drone_maintenance_drone on public.drone_maintenance(drone_id);
create index idx_drone_maintenance_due on public.drone_maintenance(due_date);

create trigger update_drone_maintenance_updated_at
  before update on public.drone_maintenance
  for each row execute function public.update_updated_at_column();

-- Pilot certifications
create table public.pilot_certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  cert_type text not null,
  issued_at date not null,
  expires_at date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pilot_certifications enable row level security;

create policy "Users manage own certifications"
  on public.pilot_certifications
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admins view all certifications"
  on public.pilot_certifications
  for select
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));

create index idx_pilot_certifications_user on public.pilot_certifications(user_id);

create trigger update_pilot_certifications_updated_at
  before update on public.pilot_certifications
  for each row execute function public.update_updated_at_column();