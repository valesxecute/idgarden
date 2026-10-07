// Public client config. The publishable key is safe to ship: row-level security
// (supabase/schema.sql) limits every user to their own garden. Empty = guest-only mode.
export default {
  supabaseUrl: 'https://norkkufzahqbbntppmrr.supabase.co',
  supabaseAnonKey: 'sb_publishable_NCmgPpttTZfbxTCJvRB4YA_0gWJGd1V',
  ai: true, // garden-ai Edge Function (Gemini free tier); falls back to the simple assistant if GEMINI_API_KEY isn't set
  // web push (Phase 8): public half of the VAPID pair; the private half is the VAPID_PRIVATE_KEY secret of garden-remind
  vapidPublicKey: 'BGlixdVyPVOI8w-H5_Yzlu0v1bdR0aL7NzPvWE1kxyUBj63GAlaW7XzIBsskDcaPCEJzE8YkHRe3porGpgWlkVw',
};
