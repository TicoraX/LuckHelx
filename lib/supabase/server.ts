import { createClient } from '@supabase/supabase-js';

// Service-role client for use in route handlers / cron jobs only — never import this in client components.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
