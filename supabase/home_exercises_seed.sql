-- Seed data: Home / no-equipment exercises
insert into exercises (name, instructions, benefits, muscle_groups, equipment, category, video_url) values

-- CHEST
('Push-ups', 'Start in a plank position with hands under shoulders, lower your chest to the floor, then press back up.', 'Builds chest, shoulder, and tricep strength using just bodyweight.', ARRAY['chest'], ARRAY[]::text[], 'home', null),
('Incline push-ups', 'Place your hands on a raised surface like a couch or chair, lower your chest toward it, then press back up.', 'A gentler push-up variation, good for building toward a full push-up.', ARRAY['chest'], ARRAY[]::text[], 'home', null),
('Decline push-ups', 'Place your feet on a raised surface with hands on the floor, lower your chest down, then press back up.', 'Increases the difficulty of a standard push-up and emphasizes the upper chest.', ARRAY['chest'], ARRAY[]::text[], 'home', null),
('Diamond push-ups', 'Form a diamond shape with your hands under your chest, lower down, then press back up.', 'Shifts more emphasis onto the chest and triceps than a standard push-up.', ARRAY['chest', 'triceps'], ARRAY[]::text[], 'home', null),
('Wide push-ups', 'Place your hands wider than shoulder-width, lower your chest down, then press back up.', 'Emphasizes the outer chest muscles.', ARRAY['chest'], ARRAY[]::text[], 'home', null),

-- BACK
('Superman', 'Lie face down, lift your arms and legs off the floor at the same time, hold briefly, then lower.', 'Strengthens the lower back and improves posture.', ARRAY['back'], ARRAY[]::text[], 'home', null),
('Reverse snow angels', 'Lie face down with arms at your sides, sweep your arms up overhead and back down like a snow angel.', 'Builds upper back strength and improves shoulder mobility.', ARRAY['back'], ARRAY[]::text[], 'home', null),
('Table/chair rows', 'Lie under a sturdy table or hold the edge of a chair, pull your chest up toward it, then lower with control.', 'A no-equipment way to build pulling strength for the back.', ARRAY['back'], ARRAY[]::text[], 'home', null),

-- SHOULDERS
('Pike push-ups', 'Start in a downward-dog position, bend your elbows to lower your head toward the floor, then press back up.', 'Builds shoulder strength and can progress toward handstand push-ups.', ARRAY['shoulders'], ARRAY[]::text[], 'home', null),
('Plank shoulder taps', 'Hold a plank position and alternate tapping each hand to the opposite shoulder.', 'Builds shoulder stability and core strength together.', ARRAY['shoulders', 'core'], ARRAY[]::text[], 'home', null),
('Arm circles', 'Extend your arms out to the sides and make small to large circles for a set time.', 'Warms up and builds endurance in the shoulder muscles.', ARRAY['shoulders'], ARRAY[]::text[], 'home', null),

-- TRICEPS
('Chair dips', 'Sit on the edge of a sturdy chair, hands beside your hips, lower your body down, then press back up.', 'Builds tricep strength using furniture you already have at home.', ARRAY['triceps'], ARRAY[]::text[], 'home', null),
('Tricep push-ups', 'Perform a push-up with your elbows tucked close to your body throughout the movement.', 'Emphasizes the triceps more than a standard push-up.', ARRAY['triceps'], ARRAY[]::text[], 'home', null),

-- QUADS
('Bodyweight squats', 'Stand with feet shoulder-width apart, lower your hips back and down, then stand back up.', 'Builds leg strength and is a foundational movement for lower-body fitness.', ARRAY['quadriceps'], ARRAY[]::text[], 'home', null),
('Jump squats', 'Perform a squat, then explode upward into a jump, landing softly back into the squat.', 'Builds explosive leg power and cardiovascular conditioning.', ARRAY['quadriceps'], ARRAY[]::text[], 'home', null),
('Lunges', 'Step forward into a lunge, lowering your back knee toward the floor, then push back to standing.', 'Builds single-leg strength and balance.', ARRAY['quadriceps'], ARRAY[]::text[], 'home', null),
('Wall sit', 'Lean your back against a wall and lower into a seated position, holding it for time.', 'Builds quad endurance and strength isometrically.', ARRAY['quadriceps'], ARRAY[]::text[], 'home', null),
('Step-ups', 'Using a stable step or sturdy chair, step up with one foot, bring the other up to meet it, then step back down.', 'Builds leg strength and balance using furniture at home.', ARRAY['quadriceps'], ARRAY[]::text[], 'home', null),

-- HAMSTRINGS & GLUTES
('Glute bridge', 'Lie on your back with knees bent, drive your hips up by squeezing your glutes, then lower with control.', 'Builds glute strength with no equipment needed.', ARRAY['glutes'], ARRAY[]::text[], 'home', null),
('Single-leg glute bridge', 'Perform a glute bridge with one leg extended straight out.', 'Increases the challenge and addresses side-to-side imbalances.', ARRAY['glutes'], ARRAY[]::text[], 'home', null),
('Donkey kicks', 'On hands and knees, kick one leg up and back while keeping your knee bent, then lower with control.', 'Isolates the glutes for targeted strength.', ARRAY['glutes'], ARRAY[]::text[], 'home', null),
('Fire hydrants', 'On hands and knees, lift one bent leg out to the side, then lower with control.', 'Targets the outer glutes and hip stabilizers.', ARRAY['glutes'], ARRAY[]::text[], 'home', null),

-- CALVES
('Standing calf raises', 'Stand with feet hip-width apart, rise up onto your toes, then lower your heels back down.', 'Builds calf strength and can be done anywhere.', ARRAY['calves'], ARRAY[]::text[], 'home', null),
('Single-leg calf raise', 'Stand on one foot and rise up onto your toes, then lower with control.', 'Increases the challenge and addresses side-to-side imbalances in the calves.', ARRAY['calves'], ARRAY[]::text[], 'home', null),

-- ABS / CORE
('Plank', 'Hold your body in a straight line supported on your forearms and toes, keeping your core braced.', 'Builds core stability and endurance.', ARRAY['core'], ARRAY[]::text[], 'home', null),
('Side plank', 'Support your body on one forearm and the side of one foot, keeping your body in a straight line.', 'Targets the obliques and improves core stability.', ARRAY['core'], ARRAY[]::text[], 'home', null),
('Crunches', 'Lie on your back with knees bent, curl your shoulders up toward your knees, then lower with control.', 'A classic core exercise for building abdominal strength.', ARRAY['core'], ARRAY[]::text[], 'home', null),
('Bicycle crunches', 'Lie on your back and alternate bringing opposite elbow to opposite knee in a pedaling motion.', 'Targets the abs and obliques together.', ARRAY['core'], ARRAY[]::text[], 'home', null),
('Leg raises', 'Lie on your back, keep your legs straight, and raise them up toward the ceiling, then lower with control.', 'Builds lower ab strength.', ARRAY['core'], ARRAY[]::text[], 'home', null),
('Mountain climbers', 'Start in a plank position and alternate driving your knees toward your chest quickly.', 'Combines core strengthening with a cardio challenge.', ARRAY['core'], ARRAY[]::text[], 'home', null),
('Flutter kicks', 'Lie on your back with legs straight, alternate small up-and-down kicks while keeping your core braced.', 'Builds lower ab endurance.', ARRAY['core'], ARRAY[]::text[], 'home', null),
('Russian twists', 'Sit with knees bent and torso leaned back slightly, rotate your torso side to side.', 'Targets the obliques for rotational core strength.', ARRAY['core'], ARRAY[]::text[], 'home', null),

-- FULL-BODY / CARDIO
('Burpees', 'Drop into a squat, kick your feet back into a plank, do a push-up, jump your feet back in, then jump up.', 'A high-intensity full-body movement that builds strength and cardio fitness together.', ARRAY['cardiovascular system'], ARRAY[]::text[], 'home', null),
('Jumping jacks', 'Jump your feet out while raising your arms overhead, then jump back to the starting position.', 'A simple, effective way to raise your heart rate anywhere.', ARRAY['cardiovascular system'], ARRAY[]::text[], 'home', null),
('High knees', 'Run in place while driving your knees up toward your chest as high as possible.', 'Builds cardiovascular fitness and leg speed.', ARRAY['cardiovascular system'], ARRAY[]::text[], 'home', null),
('Bear crawl', 'Move forward on your hands and feet with your knees hovering just above the floor.', 'Builds full-body strength and coordination.', ARRAY['cardiovascular system'], ARRAY[]::text[], 'home', null),
('Squat jumps', 'Perform a squat, then jump explosively upward, landing softly back into the squat.', 'Builds explosive power and cardiovascular conditioning.', ARRAY['quadriceps', 'cardiovascular system'], ARRAY[]::text[], 'home', null);
