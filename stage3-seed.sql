-- Name It! / ReviseRush Stage 3 curriculum seed
-- Run AFTER Stage 2 schema.sql in Supabase SQL Editor. Idempotent.
-- Topic headings align to the supplied specifications; notes/questions are original.

insert into public.revision_topics (qualification,subject,board,title,slug,sort_order) values
('GCSE','Maths','AQA','Number','number',1),
('GCSE','Maths','AQA','Algebra','algebra',2),
('GCSE','Maths','AQA','Ratio, proportion and rates of change','ratio-proportion-rates',3),
('GCSE','Maths','AQA','Geometry and measures','geometry-measures',4),
('GCSE','Maths','AQA','Probability','probability',5),
('GCSE','Maths','AQA','Statistics','statistics',6),
('GCSE','Maths','Edexcel','Number','number',1),
('GCSE','Maths','Edexcel','Algebra','algebra',2),
('GCSE','Maths','Edexcel','Ratio, proportion and rates of change','ratio-proportion-rates',3),
('GCSE','Maths','Edexcel','Geometry and measures','geometry-measures',4),
('GCSE','Maths','Edexcel','Probability','probability',5),
('GCSE','Maths','Edexcel','Statistics','statistics',6),
('GCSE','Combined Science','AQA','Biology: Cell biology','biology-cell-biology',1),
('GCSE','Combined Science','AQA','Biology: Organisation','biology-organisation',2),
('GCSE','Combined Science','AQA','Biology: Infection and response','biology-infection-response',3),
('GCSE','Combined Science','AQA','Biology: Bioenergetics','biology-bioenergetics',4),
('GCSE','Combined Science','AQA','Biology: Homeostasis and response','biology-homeostasis-response',5),
('GCSE','Combined Science','AQA','Biology: Inheritance, variation and evolution','biology-inheritance-variation-evolution',6),
('GCSE','Combined Science','AQA','Biology: Ecology','biology-ecology',7),
('GCSE','Combined Science','AQA','Chemistry: Atomic structure and the periodic table','chemistry-atomic-structure-periodic-table',8),
('GCSE','Combined Science','AQA','Chemistry: Bonding, structure and the properties of matter','chemistry-bonding-structure-properties',9),
('GCSE','Combined Science','AQA','Chemistry: Quantitative chemistry','chemistry-quantitative-chemistry',10),
('GCSE','Combined Science','AQA','Chemistry: Chemical changes','chemistry-chemical-changes',11),
('GCSE','Combined Science','AQA','Chemistry: Energy changes','chemistry-energy-changes',12),
('GCSE','Combined Science','AQA','Chemistry: The rate and extent of chemical change','chemistry-rate-extent-change',13),
('GCSE','Combined Science','AQA','Chemistry: Organic chemistry','chemistry-organic-chemistry',14),
('GCSE','Combined Science','AQA','Chemistry: Chemical analysis','chemistry-chemical-analysis',15),
('GCSE','Combined Science','AQA','Chemistry: Chemistry of the atmosphere','chemistry-atmosphere',16),
('GCSE','Combined Science','AQA','Chemistry: Using resources','chemistry-using-resources',17),
('GCSE','Combined Science','AQA','Physics: Energy','physics-energy',18),
('GCSE','Combined Science','AQA','Physics: Electricity','physics-electricity',19),
('GCSE','Combined Science','AQA','Physics: Particle model of matter','physics-particle-model',20),
('GCSE','Combined Science','AQA','Physics: Atomic structure','physics-atomic-structure',21),
('GCSE','Combined Science','AQA','Physics: Forces','physics-forces',22),
('GCSE','Combined Science','AQA','Physics: Waves','physics-waves',23),
('GCSE','Combined Science','AQA','Physics: Magnetism and electromagnetism','physics-magnetism-electromagnetism',24),
('A-level','Maths','AQA','Pure mathematics','pure-mathematics',1),
('A-level','Maths','AQA','Statistics','statistics',2),
('A-level','Maths','AQA','Mechanics','mechanics',3),
('A-level','Maths','Edexcel','Pure mathematics','pure-mathematics',1),
('A-level','Maths','Edexcel','Statistics','statistics',2),
('A-level','Maths','Edexcel','Mechanics','mechanics',3)
on conflict (qualification,subject,board,slug) do update set title=excluded.title,sort_order=excluded.sort_order;

insert into public.revision_notes(topic_id,content,key_terms)
select id,
'Number work begins with understanding different types of numbers and how they are represented. Integers are whole numbers, including negative numbers. Fractions, decimals and percentages are different ways to express parts of a whole. Use place value carefully when calculating with decimals, and keep track of units and the accuracy requested.

Equivalent fractions have the same value even when their numerators and denominators differ. To add or subtract fractions, use a common denominator. To multiply fractions, multiply the numerators and denominators; to divide by a fraction, multiply by its reciprocal.

A percentage is a number out of 100. To find a percentage of an amount, multiply by the percentage written as a decimal or fraction. Percentage multipliers are useful for repeated percentage change: use 1 plus the rate for an increase and 1 minus the rate for a decrease.',
array['Integer','Place value','Fraction','Equivalent fraction','Decimal','Percentage','Percentage multiplier']
from public.revision_topics where qualification='GCSE' and subject='Maths' and board='AQA' and slug='number'
on conflict(topic_id) do update set content=excluded.content,key_terms=excluded.key_terms,updated_at=now();

insert into public.exam_questions(topic_id,prompt,marks,model_answer,explanation,sort_order)
select id,'A jacket costs £80. It is reduced by 15%. Calculate the sale price.',3,
'15% of £80 = 0.15 × 80 = £12. Sale price = £80 − £12 = £68.',
'One mark for finding 15% of 80, one for subtracting the reduction, and one for the correct sale price with units.',1
from public.revision_topics where qualification='GCSE' and subject='Maths' and board='AQA' and slug='number'
on conflict(topic_id,sort_order) do update set prompt=excluded.prompt,marks=excluded.marks,model_answer=excluded.model_answer,explanation=excluded.explanation;

insert into public.revision_notes(topic_id,content,key_terms)
select id,
'Cells are the basic structural units of living organisms. In animal and plant cells, the nucleus contains genetic material and helps control cell activities. The cytoplasm is where many chemical reactions take place, the cell membrane controls movement of substances into and out of the cell, and mitochondria are the site of most aerobic respiration. Ribosomes are where proteins are made.

Plant cells also have a cellulose cell wall for support and, in many cells, chloroplasts containing chlorophyll for photosynthesis. A permanent vacuole contains cell sap. Bacterial cells are prokaryotic: they do not have a nucleus, and their genetic material is found in the cytoplasm.

Specialised cells have structures that help them perform particular functions. A root hair cell has an extended surface area for absorption. A sperm cell has a tail for movement and many mitochondria to supply energy.',
array['Nucleus','Cytoplasm','Cell membrane','Mitochondria','Ribosome','Cell wall','Chloroplast','Vacuole','Prokaryotic cell','Specialised cell']
from public.revision_topics where qualification='GCSE' and subject='Combined Science' and board='AQA' and slug='biology-cell-biology'
on conflict(topic_id) do update set content=excluded.content,key_terms=excluded.key_terms,updated_at=now();

insert into public.exam_questions(topic_id,prompt,marks,model_answer,explanation,sort_order)
select id,'Describe two differences between a typical plant cell and a typical animal cell.',3,
'Plant cells have a cellulose cell wall, whereas animal cells do not. Plant cells may contain chloroplasts for photosynthesis, whereas typical animal cells do not contain chloroplasts. Plant cells also usually have a large permanent vacuole.',
'Award credit for two correctly described differences. Accept cell wall, chloroplasts or large permanent vacuole, with a clear comparison.',1
from public.revision_topics where qualification='GCSE' and subject='Combined Science' and board='AQA' and slug='biology-cell-biology'
on conflict(topic_id,sort_order) do update set prompt=excluded.prompt,marks=excluded.marks,model_answer=excluded.model_answer,explanation=excluded.explanation;

insert into public.revision_notes(topic_id,content,key_terms)
select id,
'A-level pure mathematics develops algebraic methods, functions, proof, coordinate geometry, sequences and series, trigonometry, exponentials and logarithms, differentiation, integration, numerical methods and vectors. These ideas are connected: algebraic manipulation supports differentiation, while differentiation and integration describe changing quantities and accumulated change.

A function maps each permitted input to exactly one output. The domain is the set of allowed inputs and the range is the set of outputs. Composite functions apply one function after another, and an inverse function reverses the mapping where an inverse exists.

Differentiation gives the gradient of a curve and can be used to find stationary points and model rates of change. Integration reverses differentiation and can be used to find areas and accumulated quantities. In exam work, show the method clearly and interpret the result in context.',
array['Function','Domain','Range','Composite function','Inverse function','Differentiation','Integration','Stationary point']
from public.revision_topics where qualification='A-level' and subject='Maths' and board='AQA' and slug='pure-mathematics'
on conflict(topic_id) do update set content=excluded.content,key_terms=excluded.key_terms,updated_at=now();

insert into public.exam_questions(topic_id,prompt,marks,model_answer,explanation,sort_order)
select id,'Given f(x) = 3x² − 4x + 1, find f′(x).',2,'f′(x) = 6x − 4.',
'Apply the power rule to each term: the derivative of 3x² is 6x, the derivative of −4x is −4, and the derivative of a constant is zero.',1
from public.revision_topics where qualification='A-level' and subject='Maths' and board='AQA' and slug='pure-mathematics'
on conflict(topic_id,sort_order) do update set prompt=excluded.prompt,marks=excluded.marks,model_answer=excluded.model_answer,explanation=excluded.explanation;
