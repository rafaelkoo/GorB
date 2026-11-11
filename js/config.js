// Fill these in from Supabase → Project Settings → API.
// The anon key is meant to be public; the database rules (RLS) are what protect the data.
// NEVER put the service_role key here or anywhere in this repo.
export const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';

export const PHOTO_BUCKET = 'checkins';
export const PHOTO_MAX_PX = 1080;   // longest side after resize
export const PHOTO_QUALITY = 0.8;   // JPEG quality
