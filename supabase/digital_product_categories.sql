-- Guides & Plans catalog categories (roadmap: "list of Guides & plans to
-- buy" grouped into Workout / Nutrition / Training Programmes /
-- Transformation Plans / Beginner Guides / Weight Loss Guides). Adds a
-- constrained category column to the existing digital_products table and
-- seeds one real, admin-authored product per category so every section has
-- genuine content rather than an empty shelf. The pre-existing "4-Week Fat
-- Loss Meal Plan" is assigned to weight_loss.
-- ─────────────────────────────────────────────
alter table digital_products add column if not exists category text not null default 'workout_guides';

alter table digital_products drop constraint if exists digital_products_category_check;
alter table digital_products add constraint digital_products_category_check
  check (category in (
    'workout_guides',
    'nutrition_guides',
    'training_programmes',
    'transformation_plans',
    'beginner_guides',
    'weight_loss'
  ));

update digital_products set category = 'weight_loss' where title = '4-Week Fat Loss Meal Plan';

-- Workout Guides
insert into digital_products (title, description, price_cents, category)
select
  'Full-Body Home Workout Guide',
  'No-equipment full-body routines you can do in your living room in 30 minutes.',
  999,
  'workout_guides'
where not exists (select 1 from digital_products where title = 'Full-Body Home Workout Guide');

insert into digital_product_content (product_id, body)
select id, $$FULL-BODY HOME WORKOUT GUIDE

No gym, no problem. This guide gives you three full-body routines built entirely from bodyweight moves, so you can train anywhere with just a few square feet of floor space.

HOW TO USE THIS GUIDE
Pick one routine below and repeat it 3 times a week, resting at least one day between sessions. Rotate to the next routine every 2 weeks to keep progressing. Rest 45-60 seconds between sets.

ROUTINE A — FOUNDATIONS (Weeks 1-2)
1. Bodyweight squats — 3 sets x 15 reps
2. Push-ups (knees down if needed) — 3 sets x 8-12 reps
3. Glute bridges — 3 sets x 15 reps
4. Plank — 3 sets x 20-30 seconds
5. Walking lunges — 3 sets x 10 reps per leg

ROUTINE B — BUILD (Weeks 3-4)
1. Jump squats — 3 sets x 12 reps
2. Incline push-ups (hands on a chair/step) — 3 sets x 12 reps
3. Single-leg glute bridges — 3 sets x 10 reps per leg
4. Side plank — 3 sets x 20 seconds per side
5. Reverse lunges — 3 sets x 12 reps per leg

ROUTINE C — CHALLENGE (Weeks 5-6)
1. Pistol squat progressions (assisted) — 3 sets x 6 reps per leg
2. Diamond push-ups — 3 sets x 10 reps
3. Single-leg deadlifts (bodyweight) — 3 sets x 10 reps per leg
4. Plank shoulder taps — 3 sets x 20 taps
5. Jump lunges — 3 sets x 10 reps per leg

WARM-UP (do before every session, 5 minutes)
Arm circles, bodyweight squats, torso twists, high knees, and light jogging in place.

PROGRESSION TIPS
- If a rep range feels easy for all 3 sets, add reps before adding sets.
- Slow the eccentric (lowering) portion of any move down to 3 seconds to increase difficulty without extra equipment.
- Log your reps each session in the Nutrition or History tab's notes so you can see real progress week to week.

SAFETY
Stop any move that causes joint pain (not muscle fatigue). Keep your core braced during planks and lunges to protect your lower back.$$
from digital_products where title = 'Full-Body Home Workout Guide'
and not exists (select 1 from digital_product_content where product_id = digital_products.id);

-- Nutrition Guides
insert into digital_products (title, description, price_cents, category)
select
  'Macro Counting Made Simple',
  'A plain-English walkthrough of how to calculate and hit your protein, carb, and fat targets.',
  999,
  'nutrition_guides'
where not exists (select 1 from digital_products where title = 'Macro Counting Made Simple');

insert into digital_product_content (product_id, body)
select id, $$MACRO COUNTING MADE SIMPLE

Macros ("macronutrients") are protein, carbohydrates, and fat -- the three nutrients that make up all the calories you eat. Counting them gives you far more control over your results than counting calories alone.

WHY MACROS MATTER
- Protein preserves and builds muscle, and keeps you fuller for longer.
- Carbs fuel your workouts and daily energy.
- Fat supports hormone production and nutrient absorption.
Two people eating the same 2,000 calories but very different macro splits will see very different results.

STEP 1: FIND YOUR CALORIE TARGET
Your Profile tab already calculates this for you from your height, weight, age, sex, activity level, and goal, using the Mifflin-St Jeor formula. That number is your starting point.

STEP 2: SET YOUR PROTEIN
Aim for roughly 1.6-2.2g of protein per kilogram of bodyweight per day if your goal is to build or preserve muscle. Your Profile tab uses 1.8g/kg by default. Protein is 4 calories per gram.

STEP 3: SET YOUR FAT
A good baseline is 25% of your total daily calories from fat. Fat is 9 calories per gram -- the most calorie-dense of the three macros, so small amounts add up fast.

STEP 4: FILL THE REST WITH CARBS
Whatever calories remain after protein and fat go to carbs, at 4 calories per gram. Carbs are your main energy source for workouts, so don't fear them -- under-fueling carbs is one of the most common reasons people feel exhausted mid-program.

HOW TO TRACK
Log every meal in the Nutrition tab. Use Search first (it pulls real USDA database values) and only fall back to Ask AI for an estimate when a food isn't in the database -- database values are always more accurate than an AI guess.

REALISTIC EXPECTATIONS
Hitting your macros exactly every single day isn't the goal -- getting close on most days, most weeks, is what actually drives results. Don't let one off day derail the next.$$
from digital_products where title = 'Macro Counting Made Simple'
and not exists (select 1 from digital_product_content where product_id = digital_products.id);

-- Training Programmes
insert into digital_products (title, description, price_cents, category)
select
  '8-Week Progressive Overload Programme',
  'A structured 4-day split that adds weight or reps every week so you keep getting stronger.',
  1999,
  'training_programmes'
where not exists (select 1 from digital_products where title = '8-Week Progressive Overload Programme');

insert into digital_product_content (product_id, body)
select id, $$8-WEEK PROGRESSIVE OVERLOAD PROGRAMME

Progressive overload -- gradually doing more work over time -- is the single biggest driver of strength and muscle gains. This programme structures that increase for you over 8 weeks so you're never guessing what to do next.

THE SPLIT (4 days per week)
Day 1: Upper Body Push (chest, shoulders, triceps)
Day 2: Lower Body (quads, hamstrings, glutes)
Day 3: Rest or light cardio
Day 4: Upper Body Pull (back, biceps)
Day 5: Lower Body + Core
Day 6-7: Rest

THE CORE RULE
For every main lift, do 3 sets. Once you can complete all 3 sets at the top of your rep range (e.g. 3x10) with good form, increase the weight by the smallest available increment next session and drop back to the bottom of the range (e.g. 3x8). This is the entire engine of the programme -- write your numbers down every session (the Exercises tab's saved/starred list is a good place to keep your go-to lifts handy).

WEEKS 1-2: FOUNDATION (build to 3x8-10 on all main lifts)
Push: Bench press, overhead press, tricep dips
Pull: Rows, lat pulldowns/pull-ups, bicep curls
Legs: Squats, Romanian deadlifts, walking lunges, calf raises

WEEKS 3-5: ACCUMULATION (3x10-12, add one accessory move per day)
Same main lifts, plus: chest flys, lateral raises, face pulls, leg press

WEEKS 6-8: INTENSIFICATION (drop to 3x6-8, heavier weight)
Same main lifts at your heaviest working weights of the programme. This is where the earlier weeks' consistency pays off.

DELOAD
If week 6 or 7 feels unusually heavy everywhere, take one week at 60% of your normal weights for all lifts, then resume. This isn't a setback -- it's part of the plan.

TRACKING
Log a workout every training day in the Streaks tab to keep your consistency visible, and use My Plans to build this split as a real plan you can follow day by day.$$
from digital_products where title = '8-Week Progressive Overload Programme'
and not exists (select 1 from digital_product_content where product_id = digital_products.id);

-- Transformation Plans
insert into digital_products (title, description, price_cents, category)
select
  '12-Week Body Recomposition Plan',
  'A combined training + nutrition roadmap for building muscle and losing fat at the same time.',
  2499,
  'transformation_plans'
where not exists (select 1 from digital_products where title = '12-Week Body Recomposition Plan');

insert into digital_product_content (product_id, body)
select id, $$12-WEEK BODY RECOMPOSITION PLAN

Body recomposition -- building muscle and losing fat at the same time -- works best for beginners, people returning after time off, and anyone carrying some extra body fat while wanting to get stronger. This plan combines training and nutrition into one 12-week roadmap.

PHASE 1: WEEKS 1-4 -- ESTABLISH THE HABIT
Training: 3 full-body strength sessions per week (squat, hinge, push, pull, carry pattern each session).
Nutrition: Eat at roughly your maintenance calories (the Profile tab's "maintain" goal target). Hit your protein target every day -- this phase is about proving you can be consistent before anything else.
Track: Log every workout and every meal without exception. Consistency data from these 4 weeks is what phase 2 is built on.

PHASE 2: WEEKS 5-8 -- ADD INTENSITY
Training: Move to 4 sessions per week, upper/lower split, and start applying progressive overload (add weight or reps weekly on your main lifts).
Nutrition: Shift to a small calorie deficit (roughly 300-500 below maintenance) on training days, keep to maintenance on rest days if you can. Protein target stays high or increases slightly -- this protects muscle while you're in a deficit.
Recovery: Prioritize 7+ hours of sleep -- log it in the Sleep tab and watch how consistency there tracks with how your lifts feel.

PHASE 3: WEEKS 9-12 -- PUSH AND ASSESS
Training: Keep the 4-day split, increase weight on lifts where you've stalled by dropping reps back down and building up again (a mini progressive-overload reset).
Nutrition: Hold the deficit. If your weight hasn't moved in 2+ weeks despite consistent logging, drop calories by another 100-150.
Reassess: At week 12, retake your body stats in the Profile tab and compare your Streaks history and Nutrition logs from week 1 to week 12 -- the trend across 12 weeks of real logged data tells you far more than any single day.

NON-NEGOTIABLES THROUGHOUT
- Protein at target, every day.
- At least 3 strength sessions a week, no exceptions.
- Sleep logged, aiming for consistency over perfection.
Recomposition is slow by nature -- the scale may barely move some weeks while your strength and how clothes fit both improve. Trust the weekly training and nutrition logs over the scale alone.$$
from digital_products where title = '12-Week Body Recomposition Plan'
and not exists (select 1 from digital_product_content where product_id = digital_products.id);

-- Beginner Guides
insert into digital_products (title, description, price_cents, category)
select
  'Gym Beginner''s Starter Guide',
  'Never set foot in a gym before? This walks you through equipment, etiquette, and your first month.',
  799,
  'beginner_guides'
where not exists (select 1 from digital_products where title = 'Gym Beginner''s Starter Guide');

insert into digital_product_content (product_id, body)
select id, $$GYM BEGINNER'S STARTER GUIDE

Everyone in the gym was a beginner once. This guide covers what nobody tells you before your first visit.

WHAT TO BRING
A water bottle, a towel, comfortable clothes you can move in, and trainers with flat, stable soles (avoid running shoes with heavy cushioning for lifting).

READING THE GYM FLOOR
- Free weights area: barbells, dumbbells, benches. Busiest at peak times (early morning, evening after work).
- Machines area: seated, guided-motion equipment -- the easiest place to start since the machine controls your range of motion.
- Cardio area: treadmills, bikes, rowers.
Use the Scan Equipment tab in this app any time you see a machine you don't recognize -- point your camera at it for a plain-English explanation of what it works and how to use it.

BASIC ETIQUETTE
- Re-rack your weights when you're done.
- Wipe down benches/machines after use.
- Don't "work in" on someone's equipment without asking if they're between sets and open to sharing.
- Headphones are fine, but stay aware of your surroundings near free weights.

YOUR FIRST MONTH
Week 1-2: Learn 5 machine-based movements (leg press, chest press, seated row, lat pulldown, leg curl) at a light, comfortable weight. Focus entirely on form, not weight.
Week 3-4: Add 2 free-weight basics (goblet squat, dumbbell row) once the machine versions feel natural.
Aim for 2-3 sessions a week, 30-45 minutes each. That's enough to build the habit without burning out.

COMMON BEGINNER MISTAKES
- Going too heavy too soon -- soreness that stops you training for a week defeats the purpose.
- Skipping warm-ups -- 5 minutes of light cardio and bodyweight movement prevents most early injuries.
- Comparing your week 1 to someone else's year 5. Compare your own numbers over time instead -- that's exactly what the Streaks and History tabs are for.

WHEN TO ASK FOR HELP
Most gyms have staff who will show you a machine or basic form for free if you ask -- this is completely normal and expected, not an inconvenience.$$
from digital_products where title = 'Gym Beginner''s Starter Guide'
and not exists (select 1 from digital_product_content where product_id = digital_products.id);

-- Weight Loss Guides (adds a second entry alongside the existing meal plan)
insert into digital_products (title, description, price_cents, category)
select
  'Sustainable Weight Loss Guide',
  'The habits and math behind losing fat steadily without crash dieting or burning out.',
  1299,
  'weight_loss'
where not exists (select 1 from digital_products where title = 'Sustainable Weight Loss Guide');

insert into digital_product_content (product_id, body)
select id, $$SUSTAINABLE WEIGHT LOSS GUIDE

Most weight loss attempts fail not because of bad information, but because the approach is too aggressive to sustain. This guide focuses on the pace and habits that actually last.

THE MATH, SIMPLIFIED
Fat loss happens when you consistently eat fewer calories than you burn. Your Profile tab calculates a "lose" target automatically (roughly 500 calories below maintenance), which targets about 0.5kg/1lb of fat loss per week -- fast enough to see steady progress, slow enough to preserve muscle and energy.

WHY CRASH DIETS BACKFIRE
A very large deficit (1,000+ calories below maintenance) causes rapid water-weight loss early on, but usually leads to intense hunger, muscle loss, and rebound weight regain once willpower runs out. Slow and steady genuinely outperforms extreme over any multi-month timeframe.

FOUR HABITS THAT MATTER MORE THAN ANY "DIET"
1. Protein at every meal -- keeps you full and protects muscle in a deficit. Log meals in the Nutrition tab and watch your protein bar fill toward target.
2. Consistent logging -- people who log most days lose more than people who log perfectly for a week then quit. Aim for "most days," not "every day."
3. Strength training 2-3x/week -- preserves the muscle you have while losing fat, so the weight that comes off is more fat and less muscle.
4. Sleep -- poor sleep measurably increases hunger hormones the next day. Track it in the Sleep tab.

HANDLING PLATEAUS
If your weight hasn't moved in 2-3 weeks of consistent logging, it usually means your maintenance calories have dropped as you've gotten lighter (a smaller body burns slightly less). Re-enter your current weight in the Profile tab to recalculate your target, or trim another 100-150 calories.

WHAT "SUSTAINABLE" ACTUALLY MEANS
A sustainable approach is one you could keep doing for a year without dreading it. If a plan feels miserable in week 2, it's too aggressive -- ease off before you burn out completely rather than push through and quit.$$
from digital_products where title = 'Sustainable Weight Loss Guide'
and not exists (select 1 from digital_product_content where product_id = digital_products.id);
