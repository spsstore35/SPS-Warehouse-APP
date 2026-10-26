import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://tvlfxyfbyhotqgigurec.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2bGZ4eWZieWhvdHFnaWd1cmVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5NTg3MjAsImV4cCI6MjEwODUzNDcyMH0.st0wVPcahaEhl1pA0MslvyduQZSo9Bu_rMWboG1LGJo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const SUPABASE_CONFIG = {
  url: SUPABASE_URL,
  isConfigured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
};
