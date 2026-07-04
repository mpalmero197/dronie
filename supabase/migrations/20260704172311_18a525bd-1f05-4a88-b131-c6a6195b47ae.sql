-- Enable RLS on realtime.messages to enforce default-deny for private channel
-- subscriptions. The app only uses non-private broadcast/presence channels and
-- postgres_changes (governed by table RLS), so no permissive policies are needed.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;