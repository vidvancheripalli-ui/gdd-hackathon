# GDG Hackathon Registration — Project Context & Status

## Project purpose

This is a mobile-first website for registering teams for a GDG on Campus hackathon. The intended production stack is:

- React + Vite frontend, hosted on Vercel
- Supabase Auth with Google OAuth for identity
- Supabase Postgres as the source of truth
- Supabase Edge Functions for privileged validation and submission work
- hCaptcha for bot protection
- Google Drive for payment-proof images
- Google Sheets as an optional operational copy of registration data

Payment is an offline UPI/bank transfer: the site displays an official QR code and participants upload a payment screenshot plus transaction ID.

## What is implemented

### Frontend

- A GDG-themed responsive interface using Google blue, red, yellow, and green.
- A new default home page inspired by the clean Google Careers job-posting layout.
  - It has a title, a Register button, an empty description area, and empty location/date/format fields.
  - These fields are deliberately blank so event content and dates can be added later.
- Registration page with:
  - Google sign-in call-to-action
  - Team-leader fields
  - Dynamic team-member fields based on selected team size
  - Hidden honeypot field
  - Client-side form preservation in `sessionStorage`
  - Loading and error states
- Payment page with transaction ID, image selection, file-size/type checks, and session persistence.
- Thank-you page with placeholders for problem-statement download and WhatsApp invite.

### Backend scaffolding

- Database migration defining registration attempts, registrations, members, and payments.
- Row Level Security is enabled; no direct client table policies are granted.
- `verify-registration` Edge Function scaffold:
  - Validates authenticated Google identity, fields, team size, duplicate roll numbers, honeypot, and optional server-side hCaptcha.
  - Creates a time-limited registration attempt.
- `submit-payment` Edge Function scaffold:
  - Verifies attempt ownership and expiry.
  - Validates screenshot metadata/type/size.
  - Uploads payment proof to the configured Google Drive folder.
  - Creates registration/member/payment records.
- `get-problem-statement` Edge Function scaffold that maps an authenticated registration’s domain to a configured, server-side URL.

### Verification

- Dependencies were installed with npm.
- `npm run build` completes successfully.

## Important project files

| File / folder | Purpose |
| --- | --- |
| `src/App.jsx` | Application screens and client-side flow |
| `src/styles.css` | Existing registration/payment GDG styling |
| `src/home.css` | Google Careers-inspired home-page layout |
| `src/services/registration.js` | Supabase auth and function invocations |
| `supabase/migrations/001_registration_schema.sql` | Database schema and RLS enablement |
| `supabase/functions/` | Edge Functions and shared auth helpers |
| `.env.example` | Required frontend and server-side variable names |
| `README.md` | Basic local setup and deployment commands |

## What still needs to be done

### Event content and branding

- Replace the home-page title, blank description panel, location, dates, and event format with final event content.
- Add the official payment QR image and verified account/UPI details.
- Set the event name, WhatsApp invite URL, hackathon domains, team-size rules, and problem-statement links.
- Add final logos/partner assets if desired.

### Supabase and authentication

- Create/configure a Supabase project.
- Apply the SQL migration.
- Enable and configure the Google OAuth provider, including allowed redirect URLs.
- Add the public Supabase URL and anon key to `.env.local`.
- Add server-only secrets to Supabase; never expose service-role, hCaptcha, or Google credentials in the frontend.

### CAPTCHA and abuse protection

- Create an hCaptcha site and add its public site key to the frontend and secret key to Supabase.
- Render the actual hCaptcha widget in the registration UI before production; the current UI shows an integration placeholder, while the Edge Function already supports server-side verification when `HCAPTCHA_SECRET` is configured.
- Add a concrete server-side rate-limiting implementation suitable for the deployed environment.

### Google integrations

- Create a club-controlled Google Drive folder or Shared Drive for payment screenshots.
- Create a Google service account, grant it access to that folder, and set `GOOGLE_SERVICE_ACCOUNT_JSON` and `GOOGLE_DRIVE_FOLDER_ID` as Supabase secrets.
- Configure a Google Sheet and implement/enable idempotent registration sync if operations require it. The current database and payment path do not depend on Sheets.
- Configure protected problem-statement URLs in Supabase secrets.

### Production hardening and testing

- Review and refine all input rules to match actual college roll-number, branch, section, and year requirements.
- Confirm uniqueness rules: whether every student may register only once and whether transaction IDs must be unique.
- Test the entire flow with real OAuth, hCaptcha, Drive upload, mobile browser return-from-UPI behavior, and error/retry paths.
- Add automated tests for Edge Function validation and finalization idempotency.
- Deploy frontend to Vercel and Edge Functions to Supabase; configure production environment variables.
- Run a privacy/security review before accepting participant data.

## Local development

1. Copy `.env.example` to `.env.local` and fill only frontend-safe values.
2. Run `npm install`.
3. Run `npm run dev`.
4. For production verification, run `npm run build`.

## Security notes

- Payment screenshots are intended for Google Drive, not Supabase Storage.
- Supabase service-role keys, hCaptcha secrets, and Google service-account credentials must remain server-side.
- The client must not be allowed to choose arbitrary problem-statement files or Google Drive destinations.
- Database constraints and Edge Function authorization are the final protection against duplicates and unauthorized submissions.
