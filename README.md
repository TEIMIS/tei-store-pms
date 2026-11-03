# TEI Store PMS

Preventive maintenance system for Taters store IT equipment: stores, equipment, PM checklists per equipment type, PM schedule, maintenance history, defective tracking, a manager dashboard, and user accounts with admin approval.

**Live site:** https://teimis.github.io/tei-store-pms/

## How it's built

| Part | Where |
|---|---|
| Web app (HTML, CSS, JavaScript, no build step) | This repository, served by GitHub Pages |
| Sign-in, accounts, password reset | Supabase Auth |
| Database and security rules | Supabase PostgreSQL (`supabase/schema.sql`) |

## Roles

| Role | Can do |
|---|---|
| Admin | Everything: stores, equipment, equipment types, users, delete records |
| IT Staff | Record PM and repairs; view everything else |
| Manager | Dashboard only (read-only) |
| Pending / Rejected / Disabled | Nothing: sees a waiting or no-access screen |

These rules are enforced by the database itself (Row Level Security), not just hidden in the page.

## Files

```
index.html            App shell
css/styles.css        Styles
js/config.js          Supabase URL + publishable key (safe to be public)
js/app.js             The app
assets/logo.png       TEI logo
supabase/schema.sql   Tables, roles, and security rules (run once in Supabase)
supabase/002_software_and_lease.sql   Update: software checks, lease type, daily sales sending
```

## First-time setup

1. In Supabase, open **SQL Editor → New query**, paste all of `supabase/schema.sql`, and click **Run**. Then do the same with `supabase/002_software_and_lease.sql`.
2. In a new query, paste the data import file (`seed_data.sql`, kept outside this public repo) and click **Run**.
3. Open the live site and **register first**. The first account created becomes the Admin automatically.
4. Everyone else registers from the sign-in page and waits for you to approve them in **Users**.

## Making changes

Ask Claude to change the app. Updates go into this repository, and GitHub Pages republishes the site in about a minute.

Never put the Supabase `service_role` / secret key in this repository.
