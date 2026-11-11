// Supabase project G/B (eu-west-3). Publishable key is safe to be public.
// The anon key is meant to be public; the database rules (RLS) are what protect the data.
// NEVER put the service_role key here or anywhere in this repo.
export const SUPABASE_URL = 'https://uzawqjiczhbfxhylogir.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_t5SxehGFoSQmL14an0uiEg_diY3ZRA3';

export const PHOTO_BUCKET = 'checkins';
export const PHOTO_MAX_PX = 1080;   // longest side after resize
export const PHOTO_QUALITY = 0.8;   // JPEG quality
