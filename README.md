# GDG Hackathon Registration

Mobile-first React registration UI with Supabase Edge Function and database scaffolding.

## Run locally

1. Copy `.env.example` to `.env.local` and fill frontend-safe values.
2. Run `npm install` then `npm run dev`.
3. Apply `supabase/migrations/001_registration_schema.sql` to the Supabase project.
4. Configure Google OAuth in Supabase Auth, hCaptcha, and the server-side secrets listed in `.env.example`.
5. Deploy the functions with `supabase functions deploy verify-registration submit-payment get-problem-statement`.

The QR panel is intentionally a configurable UPI/account placeholder. Replace it with the official account QR before launch. Payment proofs are sent to Google Drive by the `submit-payment` function; they are never placed in Supabase Storage.
