# FoS Productions App

Cast & crew management for **Field of Screams Branson** and **Field of Screams Nixa** — one app, both locations.

| Area | What it does |
| --- | --- |
| **Dashboard** | Tonight / next night per location, staffing vs. targets per attraction, call-ins, new applicants, crew by department, season stats |
| **Check-in** | Phone-friendly time clock: check in / out, called in, no-show, sent home, walk-ins, late flags, edit times, end-of-night "check everyone out" |
| **Schedule** | Month calendar of show nights, rehearsals, trainings and build days; bulk-add season dates; staff each night by attraction with auto-fill from availability or copy a previous night |
| **Staff** | Roster for both locations with search, filters, bulk status / department / attraction changes, CSV export, and full profiles (paperwork checklist, costume, notes & write-ups, attendance history, hours, show rate) |
| **Recruiting** | Drag-and-drop pipeline: New → Interview → Offered → Hired / Declined, fed by the public `/apply` form or the websites' Apply pages |
| **Costumes** | Wardrobe inventory by attraction: ready / in use / cleaning / needs repair / retired, assigned actor, end-of-night "send to cleaning" |
| **Messages** | Group texts and emails by location, status, department, attraction or a night's roster, with templates, `{first_name}` merge tags and a sent log |
| **Timesheets** | Hours by person for any date range, estimated gross pay, absences, payroll CSV + detailed time-clock CSV |
| **Settings** | Locations, attractions (+ actors wanted per night), departments, connection status, backup / restore, CSV staff import |

## Run it

```bash
npm install
npm run dev        # http://localhost:8799
```

With no environment variables it runs in **demo mode**: sample data saved in your browser only. Settings → Data can reset or clear it.

## Go live (shared between both locations)

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in its SQL editor.
2. Add the variables from [`.env.example`](.env.example) to Netlify (or `.env.local` for local dev).
3. Add each manager under Supabase → Authentication → Users. They sign in at `/login`.
4. Optional: Twilio (texts) and Resend (email) keys turn on real sending. Without them, messages are logged but not sent.
5. Point the websites' application forms at `/api/inbound/application?key=INBOUND_APPLICATION_KEY` (the Nixa site's `APPLY_WEBHOOK_URL`).

## Deploy

Netlify, same as the Nixa site: build `npm run build`, Next.js runtime via `@netlify/plugin-nextjs` (`netlify.toml` included).

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 3 · Supabase (Postgres, Auth, Realtime) · lucide icons.
Data access goes through `lib/store.tsx`, which talks to either `lib/adapters/local.ts` (demo) or `lib/adapters/supabase.ts` (live), so pages never care which one is active.
