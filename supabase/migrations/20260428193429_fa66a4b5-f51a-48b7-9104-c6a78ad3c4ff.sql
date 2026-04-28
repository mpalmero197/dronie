CREATE UNIQUE INDEX IF NOT EXISTS drones_pilot_serial_unique
  ON public.drones (assigned_pilot_id, lower(btrim(serial_number)))
  WHERE serial_number IS NOT NULL AND btrim(serial_number) <> '';