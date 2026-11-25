[README.md](https://github.com/user-attachments/files/35430584/README.md)
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

## Revision notes, confidence tracking and exam practice
The revision area now supports:
- Topic-by-topic revision notes and key terms.
- Per-topic confidence ratings: Confident, Sort of confident, and Not sure.
- Original practice questions with model answers, marking guidance and self-awarded marks.
- A revision progress summary showing confidence totals and saved exam-practice marks.

Run the updated `schema.sql` in Supabase after deploying this version. It is designed to be re-run: it creates the revision tables, adds starter topics and content, and does not remove existing accounts, profiles or game scores. The first sample library contains GCSE AQA Biology (Cell biology), GCSE AQA Maths (Fractions, decimals and percentages), and A-level AQA Biology (Biological molecules). Other subjects and boards will display a clear message until their topic content is added. These starter questions are original practice questions, not copied past-paper questions.

Revision content is stored in Supabase tables (`revision_topics`, `revision_notes`, `exam_questions`). Confidence ratings and exam attempts are saved per student. All access is made by the server using the existing Supabase service key; do not put that key in frontend code or GitHub.
