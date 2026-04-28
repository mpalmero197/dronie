ALTER PUBLICATION supabase_realtime ADD TABLE public.pilot_verifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pilot_profiles;
ALTER TABLE public.pilot_verifications REPLICA IDENTITY FULL;
ALTER TABLE public.pilot_profiles REPLICA IDENTITY FULL;