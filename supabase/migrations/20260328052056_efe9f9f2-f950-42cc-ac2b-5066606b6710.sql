CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_saved_flight_plans_updated_at
  BEFORE UPDATE ON public.saved_flight_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();