-- Seed data: Outdoor / park exercises
insert into exercises (name, instructions, benefits, muscle_groups, equipment, category, video_url) values

-- BACK
('Pull-ups (park bar)', 'Hang from a park pull-up bar with an overhand grip, pull your body up until your chin clears the bar, then lower with control.', 'Builds back width and grip strength using outdoor equipment.', ARRAY['back'], ARRAY['pull-up bar']::text[], 'outdoor', null),
('Chin-ups (park bar)', 'Hang from a park bar with an underhand grip, pull your body up until your chin clears the bar, then lower with control.', 'Builds back and bicep strength together.', ARRAY['back', 'biceps'], ARRAY['pull-up bar']::text[], 'outdoor', null),
('Inverted rows', 'Using a low bar or sturdy railing, lean back with feet on the ground and pull your chest up toward the bar.', 'Builds pulling strength using outdoor park equipment.', ARRAY['back'], ARRAY['bar or railing']::text[], 'outdoor', null),

-- CHEST
('Push-ups', 'Start in a plank position with hands under shoulders, lower your chest to the ground, then press back up.', 'Builds chest, shoulder, and tricep strength anywhere outdoors.', ARRAY['chest'], ARRAY[]::text[], 'outdoor', null),
('Incline push-ups (bench)', 'Place your hands on a park bench, lower your chest toward it, then press back up.', 'A gentler push-up variation using park furniture.', ARRAY['chest'], ARRAY['bench']::text[], 'outdoor', null),
('Decline push-ups (bench)', 'Place your feet on a park bench with hands on the ground, lower your chest down, then press back up.', 'Increases the difficulty of a standard push-up.', ARRAY['chest'], ARRAY['bench']::text[], 'outdoor', null),

-- SHOULDERS
('Pike push-ups', 'Start in a downward-dog position on the grass, bend your elbows to lower your head toward the ground, then press back up.', 'Builds shoulder strength outdoors with no equipment.', ARRAY['shoulders'], ARRAY[]::text[], 'outdoor', null),

-- TRICEPS
('Bench dips', 'Sit on the edge of a park bench, hands beside your hips, lower your body down, then press back up.', 'Builds tricep strength using a park bench.', ARRAY['triceps'], ARRAY['bench']::text[], 'outdoor', null),
('Diamond push-ups', 'Form a diamond shape with your hands under your chest, lower down, then press back up.', 'Emphasizes the triceps and chest together.', ARRAY['triceps', 'chest'], ARRAY[]::text[], 'outdoor', null),

-- QUADS / LEGS
('Step-ups (bench)', 'Step up onto a park bench with one foot, bring the other up to meet it, then step back down.', 'Builds leg strength and balance using park furniture.', ARRAY['quadriceps'], ARRAY['bench']::text[], 'outdoor', null),
('Box jumps (bench)', 'Jump explosively from the ground onto a sturdy, low park bench, then step back down.', 'Builds explosive leg power.', ARRAY['quadriceps'], ARRAY['bench']::text[], 'outdoor', null),
('Walking lunges', 'Step forward into a lunge, lowering your back knee toward the ground, then continue forward stepping into the next lunge.', 'Builds leg strength while covering distance in open space.', ARRAY['quadriceps'], ARRAY[]::text[], 'outdoor', null),
('Stair sprints', 'Sprint up a flight of outdoor stairs, then walk back down and repeat.', 'Builds leg power and cardiovascular fitness together.', ARRAY['quadriceps', 'cardiovascular system'], ARRAY[]::text[], 'outdoor', null),
('Hill sprints', 'Sprint up a moderate hill at high effort, then walk back down to recover and repeat.', 'Builds explosive leg strength and cardiovascular capacity.', ARRAY['quadriceps', 'cardiovascular system'], ARRAY[]::text[], 'outdoor', null),

-- HAMSTRINGS & GLUTES
('Glute bridge', 'Lie on your back on the grass with knees bent, drive your hips up by squeezing your glutes, then lower with control.', 'Builds glute strength with no equipment needed.', ARRAY['glutes'], ARRAY[]::text[], 'outdoor', null),
('Broad jumps', 'From a standing position, jump forward as far as possible, landing softly with bent knees.', 'Builds explosive lower-body power.', ARRAY['hamstrings', 'glutes'], ARRAY[]::text[], 'outdoor', null),
('Single-leg deadlift', 'Stand on one leg, hinge forward at the hips while extending the other leg back, then return to standing.', 'Builds hamstring and glute strength while improving balance.', ARRAY['hamstrings'], ARRAY[]::text[], 'outdoor', null),

-- ABS / CORE
('Hanging leg raises (park bar)', 'Hang from a park bar, raise your legs up toward your chest while keeping them straight, then lower with control.', 'Builds strong lower abs and grip strength using outdoor equipment.', ARRAY['core'], ARRAY['pull-up bar']::text[], 'outdoor', null),
('Plank', 'Hold your body in a straight line supported on your forearms and toes on the grass, keeping your core braced.', 'Builds core stability and endurance anywhere outdoors.', ARRAY['core'], ARRAY[]::text[], 'outdoor', null),
('Mountain climbers', 'Start in a plank position and alternate driving your knees toward your chest quickly.', 'Combines core strengthening with a cardio challenge.', ARRAY['core'], ARRAY[]::text[], 'outdoor', null),

-- FULL-BODY / CARDIO
('Sprint intervals', 'Alternate short bursts of maximum-effort sprinting with periods of walking or jogging to recover.', 'Builds speed and cardiovascular fitness efficiently.', ARRAY['cardiovascular system'], ARRAY[]::text[], 'outdoor', null),
('Bear crawl', 'Move forward on your hands and feet with your knees hovering just above the ground.', 'Builds full-body strength and coordination outdoors.', ARRAY['cardiovascular system'], ARRAY[]::text[], 'outdoor', null),
('Jumping jacks', 'Jump your feet out while raising your arms overhead, then jump back to the starting position.', 'A simple, effective way to raise your heart rate outdoors.', ARRAY['cardiovascular system'], ARRAY[]::text[], 'outdoor', null),
('Burpees', 'Drop into a squat, kick your feet back into a plank, do a push-up, jump your feet back in, then jump up.', 'A high-intensity full-body movement combining strength and cardio.', ARRAY['cardiovascular system'], ARRAY[]::text[], 'outdoor', null),
('Farmers carry (rocks/logs)', 'Carry a heavy rock or log in each hand and walk a set distance while keeping your posture upright.', 'Builds grip strength and full-body conditioning using natural park objects.', ARRAY['back', 'core'], ARRAY['found object']::text[], 'outdoor', null);
