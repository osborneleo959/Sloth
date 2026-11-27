[README.md](https://github.com/user-attachments/files/35530757/README.md)
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


## Stage 3: specification-aware revision setup

Run `stage3-seed.sql` in Supabase SQL Editor after the existing Stage 2 `schema.sql`.
The seed is idempotent. It adds GCSE AQA/Edexcel Maths, AQA GCSE Combined Science Trilogy,
and AQA/Edexcel A-level Maths topic structures, plus original starter notes and practice
questions for selected first topics.

The board selector is now qualification- and subject-specific. It currently offers only
the specification-backed combinations in this project: GCSE AQA/Edexcel Maths, AQA
Combined Science, AQA/Edexcel Geography and Business Studies, Edexcel History, AQA French
and RS; A-level AQA/Edexcel Maths and Edexcel History. Subjects without a supplied
specification remain selectable but show that their specification is pending.

International GCSE Mathematics (4MA1) is not mixed into UK GCSE Maths; it needs a separate
International GCSE qualification route. A-level History is recognised as Edexcel, but its
topic options depend on the route chosen by the student, so that library needs a separate
route-selection step. The Stage 3 seed provides topic structures, not complete notes and
exam questions for every topic. Add original material to `revision_notes` and
`exam_questions` as the library is expanded.


## Stage 4 – expanded game bank and Maths revision

Stage 4 expands the Name It! game bank with Maths (including iGCSE and A-level-labelled rounds), Combined Science, the remaining GCSE subjects previously listed, and A-level subject/topic rounds. The game bank is a topic-and-answer prompt bank; qualification is shown in topic labels so GCSE and A-level rounds can be distinguished.

The revision library seed is `stage4-seed.sql`. Run it in the Supabase SQL editor after the existing Stage 2 schema (and the Stage 3 seed if you have not already run it). It is idempotent. It adds Pearson Edexcel International GCSE Mathematics A (4MA1) topics under GCSE → Maths → Edexcel International, plus Edexcel A-level Mathematics topic notes and original practice questions. Students select GCSE Maths and the Edexcel International board to access the iGCSE notes.

The uploaded iGCSE specification is Pearson Edexcel International GCSE Mathematics Specification A (4MA1), Issue 2. The A-level Edexcel Maths topics follow the supplied 9MA0 specification. The additional game prompts are broad topic coverage and are not a substitute for specification-mapped revision notes; subject-specific revision libraries will be expanded as specifications are supplied.
