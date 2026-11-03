// Exercise library (ported from the prototype). One row per exercise:
// id, name, category, primary, secondary, locations, equipment (any one is enough), movement pattern,
// type (reps | hold | circuit_station), level, default working weight kg, default reps (or seconds for holds).
const ROWS = [
  ['bw_squat', 'Bodyweight squat', 'Legs', 'Quads', 'Glutes, core', 'home,gym,outdoor', 'none', 'squat', 'reps', 'beginner', 0, 15],
  ['goblet', 'Goblet squat', 'Legs', 'Quads', 'Glutes, core', 'home,gym', 'dumbbell,kettlebell', 'squat', 'reps', 'beginner', 16, 12],
  ['back_squat', 'Back squat', 'Legs', 'Quads', 'Glutes, core', 'gym', 'barbell', 'squat', 'reps', 'advanced', 40, 8],
  ['leg_press', 'Leg press', 'Legs', 'Quads', 'Glutes', 'gym', 'machine', 'squat', 'reps', 'beginner', 80, 12],
  ['split_squat', 'Bulgarian split squat', 'Legs', 'Quads', 'Glutes', 'home,gym', 'none,dumbbell,furniture', 'lunge', 'reps', 'intermediate', 12, 10],
  ['rev_lunge', 'Reverse lunge', 'Legs', 'Quads', 'Glutes', 'home,gym,outdoor', 'none', 'lunge', 'reps', 'beginner', 0, 12],
  ['walk_lunge', 'Walking lunges', 'Legs', 'Quads', 'Glutes', 'home,gym,outdoor', 'none,dumbbell', 'lunge', 'reps', 'beginner', 0, 20],
  ['wall_sit', 'Wall sit', 'Legs', 'Quads', 'Core', 'home,gym', 'none', 'squat', 'hold', 'beginner', 0, 40],
  ['calf', 'Calf raises', 'Legs', 'Calves', 'Ankles', 'home,gym', 'none,dumbbell', 'squat', 'reps', 'beginner', 20, 15],
  ['rdl', 'Romanian deadlift', 'Legs', 'Hamstrings', 'Glutes, back', 'gym', 'barbell,dumbbell', 'hinge', 'reps', 'intermediate', 40, 10],
  ['glute_bridge', 'Glute bridge', 'Legs', 'Glutes', 'Hamstrings', 'home,gym', 'none', 'hinge', 'reps', 'beginner', 0, 15],
  ['hip_thrust', 'Hip thrust', 'Legs', 'Glutes', 'Hamstrings', 'gym', 'barbell,bench', 'hinge', 'reps', 'intermediate', 50, 12],
  ['kb_swing', 'Kettlebell swing', 'Legs', 'Glutes', 'Hamstrings, back', 'home,gym', 'kettlebell', 'hinge', 'reps', 'intermediate', 16, 15],
  ['pushup', 'Push-up', 'Push', 'Chest', 'Shoulders, triceps', 'home,gym,outdoor', 'none', 'push', 'reps', 'beginner', 0, 15],
  ['pike_pushup', 'Pike push-up', 'Push', 'Shoulders', 'Triceps', 'home,gym', 'none', 'push', 'reps', 'intermediate', 0, 8],
  ['ohp', 'Overhead press', 'Push', 'Shoulders', 'Triceps', 'gym', 'barbell,dumbbell', 'push', 'reps', 'intermediate', 20, 10],
  ['bench', 'Bench press', 'Push', 'Chest', 'Shoulders, triceps', 'gym', 'barbell,bench', 'push', 'reps', 'intermediate', 40, 8],
  ['incline_db', 'Incline DB press', 'Push', 'Chest', 'Shoulders', 'gym', 'dumbbell,bench', 'push', 'reps', 'intermediate', 14, 10],
  ['dips', 'Dips', 'Push', 'Triceps', 'Chest', 'gym,outdoor', 'none', 'push', 'reps', 'advanced', 0, 10],
  ['lat_raise', 'Lateral raises', 'Push', 'Shoulders', 'Upper back', 'home,gym', 'dumbbell', 'push', 'reps', 'beginner', 6, 15],
  ['tri_push', 'Triceps pushdown', 'Push', 'Triceps', 'Shoulders', 'gym', 'machine', 'push', 'reps', 'beginner', 20, 12],
  ['band_press', 'Band overhead press', 'Push', 'Shoulders', 'Triceps', 'home', 'bands', 'push', 'reps', 'beginner', 0, 12],
  ['pullup', 'Pull-ups', 'Pull', 'Back', 'Biceps', 'home,gym,outdoor', 'pullup_bar', 'pull', 'reps', 'advanced', 0, 6],
  ['table_row', 'Table row', 'Pull', 'Back', 'Biceps', 'home', 'furniture', 'pull', 'reps', 'beginner', 0, 10],
  ['lat_pull', 'Lat pulldown', 'Pull', 'Back', 'Biceps', 'gym', 'machine', 'pull', 'reps', 'beginner', 45, 10],
  ['seated_row', 'Seated row', 'Pull', 'Back', 'Biceps', 'gym', 'machine', 'pull', 'reps', 'beginner', 45, 10],
  ['bb_row', 'Barbell row', 'Pull', 'Back', 'Biceps', 'gym', 'barbell', 'pull', 'reps', 'intermediate', 40, 10],
  ['band_row', 'Band row', 'Pull', 'Back', 'Biceps', 'home', 'bands', 'pull', 'reps', 'beginner', 0, 15],
  ['curl', 'Biceps curl', 'Pull', 'Biceps', 'Forearms', 'home,gym', 'dumbbell,barbell', 'pull', 'reps', 'beginner', 10, 12],
  ['hammer', 'Hammer curl', 'Pull', 'Biceps', 'Forearms', 'home,gym', 'dumbbell', 'pull', 'reps', 'beginner', 10, 12],
  ['face_pull', 'Face pulls', 'Pull', 'Upper back', 'Shoulders', 'home,gym', 'machine,bands', 'pull', 'reps', 'beginner', 15, 15],
  ['plank', 'Plank', 'Core', 'Core', 'Shoulders', 'home,gym,outdoor', 'none', 'core', 'hold', 'beginner', 0, 40],
  ['side_plank', 'Side plank', 'Core', 'Obliques', 'Core', 'home,gym', 'none', 'core', 'hold', 'beginner', 0, 30],
  ['dead_bug', 'Dead bug', 'Core', 'Core', 'Hip flexors', 'home,gym', 'none', 'core', 'reps', 'beginner', 0, 12],
  ['hang_knee', 'Hanging knee raises', 'Core', 'Core', 'Hip flexors', 'gym,outdoor', 'pullup_bar', 'core', 'reps', 'intermediate', 0, 12],
  ['rus_twist', 'Russian twists', 'Core', 'Obliques', 'Core', 'home,gym', 'none,dumbbell', 'core', 'reps', 'beginner', 5, 20],
  ['farmer', 'Farmer carry', 'Core', 'Grip', 'Core, traps', 'home,gym', 'dumbbell,kettlebell', 'carry', 'hold', 'intermediate', 20, 40],
  ['burpee', 'Burpee', 'Cardio', 'Full body', 'Legs, chest', 'home,outdoor', 'none', 'cardio', 'reps', 'beginner', 0, 8],
  ['mtn_climb', 'Mountain climbers', 'Cardio', 'Core', 'Shoulders', 'home,outdoor', 'none', 'cardio', 'reps', 'beginner', 0, 20],
  ['jump_rope', 'Jump rope', 'Cardio', 'Calves', 'Full body', 'home,gym,outdoor', 'none', 'cardio', 'reps', 'beginner', 0, 60],
  ['row_erg', 'Rowing machine', 'Cardio', 'Full body', 'Back', 'gym', 'machine', 'cardio', 'hold', 'beginner', 0, 300]
]

export const LIB = ROWS.map(a => ({
  id: a[0], n: a[1], cat: a[2], pri: a[3], sec: a[4], loc: a[5].split(','), eq: a[6].split(','),
  pat: a[7], type: a[8], lvl: a[9], dw: a[10], dr: a[11]
}))

export const EQLABEL = {
  none: 'No equipment', dumbbell: 'Dumbbells', barbell: 'Barbell', kettlebell: 'Kettlebell', bands: 'Resistance bands',
  pullup_bar: 'Pull-up bar', bench: 'Bench', machine: 'Machine / cable', furniture: 'Sturdy furniture'
}

export const PATLABEL = { squat: 'Squat', hinge: 'Hinge', push: 'Push', pull: 'Pull', lunge: 'Lunge', core: 'Core', carry: 'Carry', cardio: 'Cardio' }

// Distinct form cue per exercise — never a shared per-category string.
export const CUEX = {
  'Bodyweight squat': '3 seconds down. Knees track over toes. Chest up.',
  'Goblet squat': 'Elbows inside knees at the bottom. Heels planted.',
  'Reverse lunge': 'Knee kisses the floor. Front heel drives you up.',
  'Glute bridge': 'Squeeze at the top for 2 seconds. Ribs down.',
  'Wall sit': 'Thighs parallel, whole back on the wall. Breathe.',
  'Push-up': 'Body one straight line. Elbows at 45°.',
  'Pike push-up': 'Hips high, look at your feet.',
  'Table row': 'Pull chest to the edge. Squeeze shoulder blades.',
  Plank: "Glutes tight, ribs down. Don't let hips sag.",
  Burpee: 'Step back instead of jumping if form breaks.',
  'Mountain climbers': 'Hips level — no bouncing.',
  'Romanian deadlift': 'Hips back, soft knees. Bar close to the legs.',
  'Overhead press': 'Ribs down, glutes tight. Press slightly back.',
  'Biceps curl': 'Elbows pinned to your sides. No swing.',
  'Back squat': 'Brace before you unrack. Break hips and knees together.',
  'Walking lunges': 'Long step, torso tall. Push through the front heel.',
  'Leg press': 'Feet mid-platform. Never lock the knees hard.',
  'Bulgarian split squat': 'Front shin vertical. Back knee drops straight down.',
  'Calf raises': 'Pause 1 second at the top. Full stretch at the bottom.',
  'Hip thrust': 'Chin tucked, ribs down. Squeeze glutes 2 seconds at the top.',
  'Bench press': 'Feet planted, slight arch. Bar to mid-chest, elbows 45°.',
  'Incline DB press': 'Press up and slightly back. Dumbbells stay over the elbows.',
  Dips: 'Lean forward slightly. Shoulders down, away from ears.',
  'Lateral raises': 'Lead with the elbows. Stop at shoulder height — no swing.',
  'Triceps pushdown': 'Elbows pinned. Straighten fully, control the way up.',
  'Lat pulldown': 'Pull to the collarbone. Chest up, no lean-back swing.',
  'Seated row': "Pull to the belly button. Squeeze the blades, don't shrug.",
  'Pull-ups': 'Start from a dead hang. Pull with the elbows, chin over the bar.',
  'Face pulls': 'Pull to eye level, elbows high. Thumbs point behind you.',
  'Hammer curl': 'Neutral grip, elbows still. Squeeze at the top.',
  'Barbell row': 'Hinge to 45°. Pull to the lower ribs, back flat.',
  'Hanging knee raises': 'No swing — curl the pelvis, knees to chest.',
  'Russian twists': 'Rotate from the ribs, not the arms.',
  'Dead bug': 'Lower back glued to the floor. Slow opposite arm and leg.',
  'Side plank': 'One straight line, hips high. Stack the shoulders.',
  'Rowing machine': 'Legs, then back, then arms. Reverse on the way in.',
  'Jump rope': 'Bounce on the balls of your feet — wrists do the work.',
  'Kettlebell swing': 'Snap the hips, arms are ropes. Bell floats to chest height.',
  'Band overhead press': 'Stand on the band, ribs down, press straight up.',
  'Band row': 'Elbows back past the ribs. Squeeze, then slow return.',
  'Farmer carry': 'Tall posture, short quick steps. Shoulders down.'
}

export const PROGX = {
  'Bodyweight squat': '15 on all sets → move to jump squats',
  'Push-up': '12+ on all sets → feet-elevated push-ups',
  'Wall sit': '60s easy → single-leg wall sit',
  Plank: '60s easy → plank shoulder taps',
  'Glute bridge': '15+ → single-leg glute bridge',
  'Table row': '12+ → lower the table edge'
}
