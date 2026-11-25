[README.md](https://github.com/user-attachments/files/35429611/README.md)
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


## Revision hub update
The homepage now acts as the main revision hub. Student accounts support GCSE (Years 9–11) and A-level (Years 12–13), with the requested subject lists and an exam-board choice stored separately for each selected subject.

If you already have Supabase set up, run the updated `schema.sql` again in the Supabase SQL Editor. It adds the `qualification` and `subject_boards` profile columns without deleting existing profiles or scores. Existing profiles are inferred as GCSE for Years 9–11 and A-level for Years 12–13; students can review their subjects and exam boards in Profile.

The first revision-area structure is in place. Topic notes, saved topic-confidence ratings and exam-question content are the next development stage; the current game question bank is not a full GCSE/A-level curriculum question bank.
