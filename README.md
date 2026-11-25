[README.md](https://github.com/user-attachments/files/35426897/README.md)
# ReviseRush server

## Run locally
npm install && npm start  (open http://localhost:3000)

## Accounts, daily challenge and leaderboards (optional)
Needs a free Supabase project. Set these environment variables (Render: Environment tab):
- SUPABASE_URL          your Project URL
- SUPABASE_ANON_KEY     the publishable / anon key
- SUPABASE_SERVICE_KEY  the secret / service_role key (never put this in GitHub or the website code)

Run schema.sql once in the Supabase SQL Editor. Check your setup any time at /api/diag on your site.
Edit public/privacy.html (the [BRACKETED] parts) before you let students sign up.
