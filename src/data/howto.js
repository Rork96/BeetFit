// How-to for every exercise in the library: key poses for the animation plus plain-language steps.
// Pose format and options: see src/lib/pose2d.js. `steps[].f` is the key frame a step belongs to.
// Angles: 0 up, 90 forward, 180 down, -90 back.

const STAND = [0, 0, 0, 172, 168]

export const HOWTO = {
  // ---------------------------------------------------------------- legs
  bw_squat: {
    f: [STAND, [30, -80, 40, 90, 90]], hl: ['thigh'],
    steps: [
      { f: 0, t: 'Feet shoulder-width, toes turned out a little. Arms out front, chest tall.' },
      { f: 1, t: 'Sit back and down, as if onto a chair. Knees track over your toes.' },
      { f: 1, t: 'Go to thighs parallel, or as deep as your heels stay flat.' },
      { f: 0, t: 'Push the floor away and stand tall. Squeeze your glutes at the top.' }
    ],
    feel: 'Front of the thighs and glutes.',
    err: [['Heels lift off the floor', 'Weight on mid-foot. Go less deep or put a plate under the heels.'], ['Knees cave inward', 'Push the knees out over your little toes.'], ['Chest drops, back rounds', 'Eyes forward, chest proud, arms out for balance.']],
    breath: 'In on the way down, out as you stand.', hard: 'goblet'
  },
  goblet: {
    f: [[0, 0, 0, 165, 20], [30, -80, 35, 170, 15]], eq: ['bell@wrist'], hl: ['thigh'],
    steps: [
      { f: 0, t: 'Hold one weight against your chest with both hands, elbows pointing down.' },
      { f: 1, t: 'Sit straight down between your knees. Keep the weight on your chest.' },
      { f: 1, t: 'At the bottom your elbows touch the inside of your knees. Heels stay planted.' },
      { f: 0, t: 'Drive up through the whole foot and stand tall.' }
    ],
    feel: 'Thighs and glutes, with your upper back working to hold the weight.',
    err: [['Weight drifts away from the chest', 'Keep it glued to your sternum, elbows down.'], ['Rising hips first, chest folds forward', 'Push the floor away and lead with the chest.'], ['Knees collapse in', 'Use your elbows to push the knees out at the bottom.']],
    breath: 'In on the way down, out as you stand.', easy: 'bw_squat', hard: 'back_squat'
  },
  back_squat: {
    f: [[0, 0, 0, 200, 20], [30, -80, 45, 200, 20]], eq: ['bar@shoulder'], hl: ['thigh'],
    steps: [
      { f: 0, t: 'Bar on your upper back, not your neck. Grip just outside the shoulders, elbows down.' },
      { f: 0, t: 'Brace: big breath into the belly, ribs down. Unrack and step back.' },
      { f: 1, t: 'Hips back and down, knees out. The bar stays over your mid-foot.' },
      { f: 0, t: 'Drive up, chest first. Do not let the hips shoot up ahead of the shoulders.' }
    ],
    feel: 'Thighs, glutes and a tight trunk.',
    err: [['Good-morning squat (hips rise first)', 'Push the floor away. Lighten the bar until the chest leads.'], ['Bar rolls up onto the neck', 'Set it lower on the muscle shelf of the upper back.'], ['Skipping the brace', 'Breathe in and hold it through the rep. A belt does not replace this.']],
    breath: 'Big breath in and brace at the top, out after you pass the hardest part.', easy: 'goblet'
  },
  leg_press: {
    f: [[225, 225, -45, 135, 135, 135], [281.3, 175, -45, 135, 135, 135]], pin: 'hip', y: 'pin', ground: false, eq: ['plate@ankle', 'pad'], hl: ['thigh'],
    steps: [
      { f: 0, t: 'Back and hips flat on the seat. Feet shoulder-width, mid-plate.' },
      { f: 1, t: 'Lower slowly until your knees are about 90 degrees. Hips stay down.' },
      { f: 0, t: 'Press through the whole foot. Stop just short of locking the knees.' }
    ],
    feel: 'Front of the thighs and glutes.',
    err: [['Hips curl up off the seat at the bottom', 'Shorten the range until the pelvis stays flat.'], ['Knees locked hard at the top', 'Keep a soft bend. A locked knee takes the load off the muscle.'], ['Knees cave in', 'Push the knees out in line with your toes.']],
    breath: 'In on the way down, out as you press.', easy: 'goblet'
  },
  split_squat: {
    f: [[12, -25, 0, 180, 180], [20, -70, 0, 180, 180]], l2: { to: [-36.5, 33], side: 1 }, eq: ['step@ankle2'], hl: ['thigh'],
    steps: [
      { f: 0, t: 'Rear foot on a bench behind you, laces down. Front foot about a big step forward.' },
      { f: 1, t: 'Lower straight down. Your front knee tracks over the toes, torso stays upright.' },
      { f: 1, t: 'Stop when the back knee nearly touches the floor.' },
      { f: 0, t: 'Press through the front heel to stand. Do all reps, then switch legs.' }
    ],
    feel: 'Front thigh and glute, a stretch in the back leg hip.',
    err: [['Front foot too close, knee shoots far forward', 'Take a longer step so the shin stays near vertical.'], ['Torso tips forward', 'Stay tall. Hold the weights at your sides.'], ['Wobbling side to side', 'Hold a wall with a fingertip until the balance comes.']],
    breath: 'In on the way down, out as you stand.', easy: 'rev_lunge'
  },
  rev_lunge: {
    f: [STAND, [22, -58, 6, 180, 180]], l2: [{ to: [-5, 0], side: 1 }, { to: [-36, 5], side: 1, up: true }], hl: ['thigh'],
    steps: [
      { f: 0, t: 'Stand tall, hands on hips. Weight on the front foot.' },
      { f: 1, t: 'Step back and drop straight down. Back knee hovers just above the floor.' },
      { f: 1, t: 'Front shin stays near vertical, front knee over the toes.' },
      { f: 0, t: 'Drive through the front heel and step back in.' }
    ],
    feel: 'Front thigh and glute. Easier on the knees than a forward lunge.',
    err: [['Short step, knee drifts far over the toes', 'Step back further.'], ['Leaning forward', 'Keep the ribs over the hips.'], ['Back knee slams the floor', 'Lower on a count of two and just touch.']],
    breath: 'In as you step back, out as you return.', hard: 'split_squat'
  },
  walk_lunge: {
    f: [STAND, [22, -58, 6, 180, 180]], l2: [{ to: [-5, 0], side: 1 }, { to: [-36, 5], side: 1, up: true }], hl: ['thigh'],
    steps: [
      { f: 0, t: 'Stand tall, hands on hips or holding weights at your sides.' },
      { f: 1, t: 'Take a long step forward and sink until both knees are near 90 degrees.' },
      { f: 1, t: 'Keep the torso upright. The back knee hovers above the floor.' },
      { f: 0, t: 'Push off the front foot, bring the back leg through, and step into the next lunge.' }
    ],
    feel: 'Thighs and glutes, with a balance challenge.',
    err: [['Steps too short', 'Long steps keep the front shin vertical.'], ['Feet on a tightrope line', 'Keep them hip-width apart for balance.'], ['Torso folds forward', 'Chest tall, eyes forward.']],
    breath: 'Steady breathing. Exhale on each push-off.', easy: 'rev_lunge'
  },
  wall_sit: {
    f: [[0, -90, 0, 160, 95], [0, -90, 1.5, 160, 95]], eq: ['wall@hip'], hold: true, hl: ['thigh'],
    steps: [
      { f: 0, t: 'Back flat on the wall. Walk your feet out until knees are over the ankles.' },
      { f: 0, t: 'Slide down until thighs are parallel to the floor.' },
      { f: 1, t: 'Hold. Press the lower back into the wall, hands off your thighs.' }
    ],
    feel: 'A burn in the front of the thighs.',
    err: [['Hands pushing on the thighs', 'Rest them on your hips or cross them on your chest.'], ['Knees past the toes', 'Walk the feet further from the wall.'], ['Holding your breath', 'Breathe slowly in and out.']],
    breath: 'Slow and steady the whole time.', hard: 'back_squat'
  },
  calf: {
    f: [[0, 0, 0, 180, 180, 90], [0, 0, 0, 180, 180, 138]], pin: 'toe', y: 'pin', hl: ['shin'],
    steps: [
      { f: 0, t: 'Stand on the balls of both feet, heels free. Hold a wall for balance.' },
      { f: 1, t: 'Rise as high as you can and pause for a second at the top.' },
      { f: 0, t: 'Lower slowly, below the step if you are on one, and repeat.' }
    ],
    feel: 'The calf muscles, from knee down.',
    err: [['Bouncing', 'Pause at the top and lower for three seconds.'], ['Rolling onto the outside of the feet', 'Push through the big toe.'], ['Short range', 'Full stretch at the bottom, full height at the top.']],
    breath: 'Out on the way up, in on the way down.'
  },
  rdl: {
    f: [STAND, [6, -16, 66, 192, 192]], eq: ['bar@wrist'], hl: ['thigh'],
    steps: [
      { f: 0, t: 'Stand tall holding the weight in front of the thighs. Knees slightly soft.' },
      { f: 1, t: 'Push your hips straight back, like closing a car door with your butt. Weight rides down the legs.' },
      { f: 1, t: 'Stop when you feel a strong stretch in the back of the thighs. Back stays flat.' },
      { f: 0, t: 'Drive the hips forward to stand. Squeeze the glutes at the top.' }
    ],
    feel: 'A stretch in the hamstrings, then glutes as you stand.',
    err: [['Rounding the back', 'Chest proud, eyes on the floor a few feet ahead. Stop higher.'], ['Bending the knees like a squat', 'Keep a soft knee. The movement is the hips going back.'], ['Weight drifts away from the legs', 'The bar stays in contact with your thighs and shins.']],
    breath: 'Brace and breathe in at the top, out as you stand.', easy: 'glute_bridge'
  },
  glute_bridge: {
    f: [[28, 132, 97, 277, 277], [12, 105, 120, 300, 300]], gy: -3, hl: ['thigh'],
    steps: [
      { f: 0, t: 'Lie on your back, knees bent, feet flat and hip-width apart. Arms by your sides.' },
      { f: 1, t: 'Press through your heels and lift your hips until shoulders, hips and knees make a line.' },
      { f: 1, t: 'Squeeze your glutes for two seconds at the top. Ribs down.' },
      { f: 0, t: 'Lower slowly until your hips almost touch the floor.' }
    ],
    feel: 'Glutes and the back of the thighs, not the lower back.',
    err: [['Arching the lower back at the top', 'Tuck the pelvis a little and stop at a straight line.'], ['Pushing through the toes', 'Drive the heels into the floor.'], ['Knees falling in', 'Press the knees gently out.']],
    breath: 'Out as you lift, in as you lower.', hard: 'hip_thrust'
  },
  hip_thrust: {
    f: [[0, 87, 64, 244, 244], [25, 105, 38, 218, 218]], eq: ['bench@shoulder', 'bar@hip'], benchTop: 36, hl: ['thigh'],
    steps: [
      { f: 1, t: 'Upper back against the bench edge, feet flat, bar across the hip crease with a pad.' },
      { f: 0, t: 'Drive through your heels and lift until your thighs are parallel to the floor.' },
      { f: 0, t: 'Chin tucked, ribs down. Squeeze your glutes hard at the top.' },
      { f: 1, t: 'Lower under control until the hips are just above the floor.' }
    ],
    feel: 'Glutes, almost nothing else.',
    err: [['Overarching the lower back', 'Tuck the chin and ribs down. Stop at a flat torso.'], ['Feet too close or too far', 'Shins vertical at the top.'], ['Shoving the bar with the hands', 'Just steady it. The hips lift it.']],
    breath: 'Out as you lift, in as you lower.', easy: 'glute_bridge'
  },
  kb_swing: {
    f: [[8, -14, 62, 200, 205], [0, 0, 0, 92, 92]], eq: ['bell@wrist'], ms: 700, hl: ['thigh'],
    steps: [
      { f: 0, t: 'Bell a foot in front of you. Hinge, grab it, and hike it back between your legs.' },
      { f: 1, t: 'Snap your hips forward. The bell floats up to chest height because of the hips, not the arms.' },
      { f: 1, t: 'At the top you are standing tall: glutes squeezed, ribs down.' },
      { f: 0, t: 'Let the bell fall and hinge back. Do not squat it.' }
    ],
    feel: 'Glutes and hamstrings. The arms just hold on.',
    err: [['Lifting with the arms', 'Think hips. The arms are ropes.'], ['Squatting the swing', 'Push the hips back, shins stay near vertical.'], ['Leaning back at the top', 'Stand tall. Glutes squeezed, ribs down.']],
    breath: 'Out sharply as the hips snap, in as the bell drops.', easy: 'rdl'
  },

  // ---------------------------------------------------------------- push
  pushup: {
    f: [[71.6, 71.6, 71.6, 180, 180, 150], [81.2, 81.2, 81.2, 180, 180, 150]], hand: { to: [75.9, 0], side: -1 }, hl: ['ua'],
    steps: [
      { f: 0, t: 'Hands just wider than shoulders, directly under them. Body in one straight line.' },
      { f: 0, t: 'Squeeze your glutes and brace the stomach so the hips do not sag.' },
      { f: 1, t: 'Lower until your chest is a fist above the floor. Elbows about 45 degrees from the body.' },
      { f: 0, t: 'Push the floor away until your arms are straight.' }
    ],
    feel: 'Chest, front of the shoulders and triceps.',
    err: [['Hips sag or pike up', 'Squeeze glutes and abs. If you cannot hold a line, raise the hands on a bench.'], ['Elbows flared to 90 degrees', 'Tuck them to about 45 degrees.'], ['Half reps', 'Chest to a fist from the floor. If that is too hard, use an incline.']],
    breath: 'In on the way down, out as you push.', hard: 'pike_pushup'
  },
  pike_pushup: {
    f: [[28, 28, 135, 180, 180, 150], [40, 40, 150, 180, 180, 150]], hand: { to: [52, 0], side: -1 }, hl: ['ua'],
    steps: [
      { f: 0, t: 'Hands and feet on the floor, hips up high so your body makes an upside-down V.' },
      { f: 1, t: 'Bend the elbows and lower the top of your head towards a point just in front of your hands.' },
      { f: 0, t: 'Press back up, keeping the hips high the whole time.' }
    ],
    feel: 'The shoulders. A strong version of an overhead press.',
    err: [['Hips drop and it turns into a push-up', 'Walk the feet closer so the hips stay high.'], ['Elbows flaring wide', 'Keep them pointing back at about 45 degrees.'], ['Head dropping onto the hands', 'Lower in front of the hands, not between them.']],
    breath: 'In on the way down, out as you press.', easy: 'pushup'
  },
  ohp: {
    f: [STAND, [0, 0, -4, 0, 0]], hand: [{ rel: [7, 5], side: -1 }, { rel: [-1, 33], side: -1 }], eq: ['bar@wrist'], hl: ['ua'],
    steps: [
      { f: 0, t: 'Weight at the shoulders, elbows just in front of the bar. Feet hip-width, glutes squeezed.' },
      { f: 1, t: 'Press straight up. Move your head back slightly so the bar passes the face.' },
      { f: 1, t: 'Finish with arms locked, the weight directly over your mid-foot.' },
      { f: 0, t: 'Lower back to the shoulders under control.' }
    ],
    feel: 'Shoulders and triceps.',
    err: [['Leaning back into the press', 'Squeeze glutes and abs. Ribs down.'], ['Bar travels in a big arc around the face', 'Push the head through once the bar passes the forehead.'], ['Elbows flared far back', 'Keep them slightly in front.']],
    breath: 'Big breath and brace at the bottom, out as you finish the press.', easy: 'band_press'
  },
  bench: {
    f: [[0, 85.5, 90, 0, 0], [0, 85.5, 90, 0, 0]], hand: [{ rel: [2, 9], side: -1 }, { rel: [2, 33], side: -1 }], eq: ['bench@torso', 'bar@wrist'], benchTop: 24, hl: ['ua'],
    steps: [
      { f: 1, t: 'Lie back, eyes under the bar. Feet flat, shoulder blades pinched together and down.' },
      { f: 1, t: 'Grip a little wider than shoulders. Unrack and hold it over your chest.' },
      { f: 0, t: 'Lower to the lower chest, elbows about 45 degrees from the body.' },
      { f: 1, t: 'Press up and slightly back until the arms are straight.' }
    ],
    feel: 'Chest, front of the shoulders, triceps.',
    err: [['Elbows flared to 90 degrees', 'Tuck them to about 45 degrees. It is kinder to the shoulders.'], ['Bouncing the bar off the chest', 'Touch lightly, pause, press.'], ['Butt or feet lifting off', 'Five points of contact: head, upper back, glutes, both feet.']],
    breath: 'In as you lower, out as you press.', easy: 'pushup'
  },
  incline_db: {
    f: [[-5, -87, -35, 0, 0], [-5, -87, -35, 0, 0]], hand: [{ rel: [8, 2], side: -1 }, { rel: [27, 19], side: -1 }], eq: ['pad', 'seat', 'db@wrist'], hl: ['ua'],
    steps: [
      { f: 0, t: 'Set the bench at about 30 degrees. Back against it, feet flat, dumbbells at your chest.' },
      { f: 1, t: 'Press up and slightly together until your arms are straight above the upper chest.' },
      { f: 0, t: 'Lower slowly until the dumbbells are beside the chest, elbows about 45 degrees.' }
    ],
    feel: 'Upper chest and front of the shoulders.',
    err: [['Bench too steep', 'Above 45 degrees it becomes a shoulder press. Stay near 30.'], ['Dumbbells clank at the top', 'Stop with them over the shoulders and keep the tension.'], ['Arching the back off the bench', 'Keep the shoulder blades pinched and glued to the pad.']],
    breath: 'In as you lower, out as you press.', easy: 'pushup'
  },
  dips: {
    f: [[0, 0, 12, 180, 180], [0, 0, 12, 180, 180]], pin: 'shoulder', at: [[0, 34], [0, 12]], y: 'pin', ground: false,
    hand: { to: [2, 0], side: -1 }, eq: ['grip@wrist'], hl: ['ua'],
    steps: [
      { f: 0, t: 'Hold the bars, arms straight, shoulders down away from the ears. Lean slightly forward.' },
      { f: 1, t: 'Bend the elbows and lower until your upper arms are about parallel to the floor.' },
      { f: 0, t: 'Press back up until the arms are straight. Do not shrug at the top.' }
    ],
    feel: 'Triceps and lower chest.',
    err: [['Going too deep with the shoulders rolling forward', 'Stop at upper arms parallel. If it pinches, skip it.'], ['Shrugging at the top', 'Press the shoulders down away from the ears.'], ['Swinging the legs', 'Cross the ankles and keep the body still.']],
    breath: 'In as you lower, out as you press.', easy: 'pushup'
  },
  lat_raise: {
    view: 'front', f: [[6], [86]],
    steps: [
      { f: 0, t: 'Stand tall with a dumbbell in each hand at your sides, a slight bend in the elbows.' },
      { f: 1, t: 'Lift the weights out to the sides until your arms are level with the shoulders. Lead with the elbows.' },
      { f: 0, t: 'Lower slowly. Do not swing the body to get them up.' }
    ],
    feel: 'The sides of the shoulders.',
    err: [['Swinging with the body', 'Use lighter weights. Stand still.'], ['Lifting above shoulder height', 'Stop at shoulder level.'], ['Shrugging', 'Keep your shoulders down, away from the ears.']],
    breath: 'Out as you lift, in as you lower.', hard: 'ohp'
  },
  tri_push: {
    f: [[0, 0, 8, 180, 95], [0, 0, 8, 180, 178]], eq: ['cable@wrist'], cable: [8, 118], hl: ['fa'],
    steps: [
      { f: 0, t: 'Stand close to the cable, elbows pinned to your sides, forearms level.' },
      { f: 1, t: 'Press down until your arms are fully straight. Only the forearms move.' },
      { f: 0, t: 'Let the handle rise slowly until your forearms are level again.' }
    ],
    feel: 'The back of the upper arm.',
    err: [['Elbows drift forward', 'Pin them to your sides.'], ['Leaning over the bar', 'Stand tall and let the arms do the work. Lower the weight.'], ['Letting the weight slam up', 'Control it for two seconds on the way up.']],
    breath: 'Out as you press down, in as it rises.', easy: 'dips'
  },
  band_press: {
    f: [[0, 0, 0, 0, 0], [0, 0, -3, 0, 0]], hand: [{ rel: [7, 4], side: -1 }, { rel: [-1, 33], side: -1 }], eq: ['band@wrist'], band: true, hl: ['ua'],
    steps: [
      { f: 0, t: 'Stand on the middle of the band, hands holding it at shoulder height.' },
      { f: 1, t: 'Press straight up until your arms are locked out over your head.' },
      { f: 0, t: 'Lower slowly back to the shoulders.' }
    ],
    feel: 'Shoulders and triceps.',
    err: [['Leaning back', 'Squeeze the glutes and keep ribs down.'], ['Band too slack', 'Shorten the grip or step on it with both feet.'], ['Flared elbows', 'Keep them slightly in front.']],
    breath: 'Out as you press, in as you lower.', hard: 'ohp'
  },

  // ---------------------------------------------------------------- pull
  pullup: {
    f: [[0, 0, 0, 0, 0], [0, 0, -8, 0, 0]], pin: 'shoulder', at: [[0, -34], [0, -10]], y: 'pin', ground: false,
    hand: { to: [2, 0], side: 1 }, eq: ['grip@wrist'], hl: ['ua'],
    steps: [
      { f: 0, t: 'Hang from the bar, hands a bit wider than shoulders. Shoulders pulled down, body still.' },
      { f: 1, t: 'Pull your elbows down to your ribs until your chin passes the bar.' },
      { f: 0, t: 'Lower under control all the way to a full hang.' }
    ],
    feel: 'The back (lats) and biceps.',
    err: [['Swinging or kipping', 'Cross the ankles, squeeze the glutes, and keep the body still.'], ['Half reps', 'Start every rep from a full hang.'], ['Shrugging the shoulders up', 'Start by pulling the shoulders down, then bend the arms.']],
    breath: 'Out as you pull, in as you lower.', easy: 'lat_pull'
  },
  table_row: {
    f: [[84, 84, 84, 0, 0, 90], [66, 66, 66, 0, 0, 90]], hand: { to: [76, 41], side: -1 }, eq: ['ledge'], ledgeTop: 41, ledgeX: 76, hl: ['ua'],
    steps: [
      { f: 0, t: 'Lie under a sturdy table, hold its edge with both hands. Heels on the floor, body straight.' },
      { f: 1, t: 'Pull your chest up to the edge, squeezing your shoulder blades together.' },
      { f: 0, t: 'Lower slowly until your arms are straight.' }
    ],
    feel: 'The middle of the back and biceps.',
    err: [['Hips sag', 'Squeeze glutes so your body stays one line.'], ['Using a table that is not stable', 'Test it first. A heavy, solid table only.'], ['Pulling with the neck', 'Lead with your chest to the edge.']],
    breath: 'Out as you pull, in as you lower.', hard: 'pullup'
  },
  lat_pull: {
    f: [[-5, -87, -8, 0, 0], [-5, -87, -14, 0, 0]], hand: [{ rel: [6, 32], side: -1 }, { rel: [12, -4], side: -1 }], eq: ['seat', 'bar@wrist', 'cable@wrist'], cable: [8, 140], hl: ['ua'],
    steps: [
      { f: 0, t: 'Sit with thighs snug under the pad. Hands a little wider than shoulders on the bar.' },
      { f: 1, t: 'Lean back slightly, then pull the bar to your upper chest, elbows going down and back.' },
      { f: 0, t: 'Let it rise slowly until your arms are straight again.' }
    ],
    feel: 'The sides and middle of the back.',
    err: [['Pulling behind the neck', 'Pull to the front of the chest.'], ['Swinging the torso', 'Small lean, then keep still. Lower the weight.'], ['Shrugging up', 'Pull the shoulders down first.']],
    breath: 'Out as you pull, in as it rises.', hard: 'pullup'
  },
  seated_row: {
    f: [[-80, -85, 15, 0, 0], [-80, -85, -5, 0, 0]], hand: [{ rel: [32, -4], side: -1 }, { rel: [6, -9], side: -1 }], eq: ['grip@wrist', 'cable@wrist'], cable: [45, 24], hl: ['ua'],
    steps: [
      { f: 0, t: 'Sit tall, feet on the plates, knees soft. Arms straight, shoulders relaxed.' },
      { f: 1, t: 'Pull the handle to your stomach, driving the elbows back along your sides.' },
      { f: 1, t: 'Squeeze the shoulder blades together for a second.' },
      { f: 0, t: 'Let the handle go forward slowly. Do not round the back.' }
    ],
    feel: 'The middle of the back, between the shoulder blades.',
    err: [['Rocking the torso', 'Sit tall and keep the torso still. Lower the weight.'], ['Shrugging', 'Keep the shoulders down away from the ears.'], ['Rounding on the way forward', 'Stop where the back stays flat.']],
    breath: 'Out as you pull, in as it returns.', easy: 'band_row'
  },
  bb_row: {
    f: [[6, -16, 64, 180, 180], [6, -16, 64, 180, 180]], hand: [{ rel: [1, -32], side: -1 }, { rel: [-6, -14], side: -1 }], eq: ['bar@wrist'], hl: ['ua'],
    steps: [
      { f: 0, t: 'Hinge forward at the hips, back flat, knees soft. Bar hangs under your shoulders.' },
      { f: 1, t: 'Pull the bar to your lower ribs, elbows back past the torso.' },
      { f: 1, t: 'Squeeze the shoulder blades together, torso still.' },
      { f: 0, t: 'Lower under control until the arms are straight.' }
    ],
    feel: 'The back and the back of the shoulders.',
    err: [['Standing up as you pull', 'Keep the same hip angle through the set.'], ['Rounded lower back', 'Lighten the weight and keep the chest proud.'], ['Jerking the bar', 'Pull smooth and pause at the top.']],
    breath: 'Brace, pull while exhaling, inhale on the way down.', easy: 'seated_row'
  },
  band_row: {
    f: [[0, 0, 0, 90, 90], [0, 0, 0, 90, 90]], hand: [{ rel: [31, -3], side: -1 }, { rel: [7, -6], side: -1 }], eq: ['cable@wrist'], cable: [75, 74], hl: ['ua'],
    steps: [
      { f: 0, t: 'Anchor the band at chest height. Stand back until it is taut, arms straight.' },
      { f: 1, t: 'Pull your elbows back past your ribs and squeeze the shoulder blades together.' },
      { f: 0, t: 'Return slowly, keeping tension in the band.' }
    ],
    feel: 'The middle of the back.',
    err: [['Shrugging', 'Shoulders down and back.'], ['Leaning back as you pull', 'Stay tall with soft knees.'], ['Letting the band snap forward', 'Return over two to three seconds.']],
    breath: 'Out as you pull, in as it returns.', hard: 'seated_row'
  },
  curl: {
    f: [STAND, [0, 0, 0, 180, 22]], eq: ['db@wrist'], hl: ['ua'],
    steps: [
      { f: 0, t: 'Stand tall, weights at your sides, elbows tucked beside your ribs.' },
      { f: 1, t: 'Curl up by bending only the elbow. The upper arm stays still.' },
      { f: 1, t: 'Squeeze at the top and keep the wrist straight.' },
      { f: 0, t: 'Lower slowly to a full stretch.' }
    ],
    feel: 'The front of the upper arm.',
    err: [['Swinging with the hips and back', 'Lighter weight. Put your back against a wall.'], ['Elbows drifting forward', 'Keep them pinned at your sides.'], ['Dropping the weight fast', 'Take three seconds to lower.']],
    breath: 'Out as you curl, in as you lower.', hard: 'hammer'
  },
  hammer: {
    f: [STAND, [0, 0, 0, 180, 22]], eq: ['dbh@wrist'], hl: ['ua', 'fa'],
    steps: [
      { f: 0, t: 'Stand tall, weights at your sides with palms facing your thighs.' },
      { f: 1, t: 'Curl up keeping the palms facing each other all the way.' },
      { f: 0, t: 'Lower slowly. The elbows stay by your sides.' }
    ],
    feel: 'The biceps and the muscle on top of the forearm.',
    err: [['Swinging', 'Lighten the weight and stand still.'], ['Elbows forward', 'Pin them to your sides.'], ['Twisting the wrists', 'Keep the thumbs on top throughout.']],
    breath: 'Out as you curl, in as you lower.', easy: 'curl'
  },
  face_pull: {
    f: [[0, 0, 0, 90, 90], [0, 0, 0, 90, 90]], hand: [{ rel: [30, 4], side: 1 }, { rel: [10, 8], side: 1 }], eq: ['cable@wrist'], cable: [76, 85], hl: ['ua'],
    steps: [
      { f: 0, t: 'Set the band or rope at face height. Arms out straight, ribs down.' },
      { f: 1, t: 'Pull toward your face, elbows high and wide, hands ending beside the ears.' },
      { f: 1, t: 'Squeeze the back of the shoulders for a second.' },
      { f: 0, t: 'Let it go slowly back out.' }
    ],
    feel: 'The back of the shoulders and upper back.',
    err: [['Leaning back', 'Stay tall, lighter band.'], ['Elbows dropping low', 'Keep the elbows at or above the hands.'], ['Pulling with the biceps', 'Think pulling the elbows apart.']],
    breath: 'Out as you pull, in as it returns.', easy: 'band_row'
  },

  // ---------------------------------------------------------------- core
  plank: {
    f: [[83.4, 83.4, 83.4, 180, 90, 150], [83, 83, 83, 180, 90, 150]], hold: true, hl: ['torso'],
    steps: [
      { f: 0, t: 'Forearms on the floor, elbows right under your shoulders. Toes tucked.' },
      { f: 0, t: 'Squeeze glutes and abs so your body is one straight line, head to heels.' },
      { f: 1, t: 'Hold, breathing slowly. Push the floor away so the shoulders do not sink.' }
    ],
    feel: 'Abs and glutes. Not the lower back.',
    err: [['Hips sag and the lower back arches', 'Tuck the pelvis, squeeze the glutes. Stop the set when it goes.'], ['Hips pike up', 'Lower them until head to heels is straight.'], ['Holding your breath', 'Breathe in and out slowly.']],
    breath: 'Slow and steady. Do not hold it.', hard: 'mtn_climb'
  },
  side_plank: {
    f: [[80, 80, 80, 180, 90, 150], [80, 80, 80, 180, 90, 150]], arm2: [0, 0], hold: true, hl: ['torso'],
    steps: [
      { f: 0, t: 'Lie on your side, elbow under your shoulder, legs stacked.' },
      { f: 0, t: 'Lift your hips until your body is a straight line from head to feet.' },
      { f: 1, t: 'Hold. Top hand on the hip or reaching to the ceiling. Do both sides.' }
    ],
    feel: 'The sides of the trunk (obliques).',
    err: [['Hips sag toward the floor', 'Drive the hip up. Bend the knees if you must.'], ['Rolling forward or back', 'Stack the shoulders and hips over each other.'], ['Shoulder sinking', 'Push the floor away through the elbow.']],
    breath: 'Slow and steady.', easy: 'plank'
  },
  dead_bug: {
    f: [[90, 180, 90, 0, 0], [90, 180, 90, 90, 90]], pin: 'hip', gy: -3, l2: [{ to: [-23, 26], side: -1 }, { to: [-49, 2], side: -1 }], hl: ['torso'],
    steps: [
      { f: 0, t: 'On your back, arms straight up, knees over your hips bent to 90 degrees.' },
      { f: 0, t: 'Press the lower back flat into the floor and keep it there.' },
      { f: 1, t: 'Slowly lower one arm overhead and the opposite leg out straight, hovering above the floor.' },
      { f: 0, t: 'Bring them back and switch sides.' }
    ],
    feel: 'Deep abs. The lower back should stay on the floor.',
    err: [['Lower back arches off the floor', 'Shrink the movement. Only lower as far as the back stays flat.'], ['Moving fast', 'Take three seconds out and back.'], ['Holding your breath', 'Breathe out as the limbs lower.']],
    breath: 'Out as the arm and leg extend, in as they return.', hard: 'hang_knee'
  },
  hang_knee: {
    f: [[0, 0, 0, 0, 0], [2, -100, 8, 0, 0]], pin: 'wrist', y: 'pin', ground: false, eq: ['grip@wrist'], hl: ['thigh'],
    steps: [
      { f: 0, t: 'Hang from the bar with straight arms. Shoulders pulled down, legs together.' },
      { f: 1, t: 'Lift your knees to your chest by curling the pelvis up, not by swinging.' },
      { f: 0, t: 'Lower slowly to a full hang and stop any swing before the next rep.' }
    ],
    feel: 'Lower abs and hip flexors.',
    err: [['Swinging', 'Pause at the bottom. Squeeze your glutes.'], ['Only the legs move', 'Curl the pelvis towards your ribs.'], ['Shoulders shrug up', 'Pull them down and away from the ears.']],
    breath: 'Out as the knees rise, in as they lower.', easy: 'dead_bug'
  },
  rus_twist: {
    f: [[-30, 225, -35, 130, 100], [-30, 225, -35, 150, 120]], pin: 'hip', gy: -3, hl: ['torso'],
    steps: [
      { f: 0, t: 'Sit and lean back until you feel your abs working. Feet on the floor or just off it.' },
      { f: 0, t: 'Hold your hands together in front of your chest. Keep the chest tall.' },
      { f: 1, t: 'Rotate your trunk to one side, then the other, moving the shoulders, not just the arms.' }
    ],
    feel: 'The sides of the abs (obliques).',
    err: [['Rounding the back', 'Stay tall. Lean back less, or keep your feet down.'], ['Only moving the arms', 'Turn the chest with the hands.'], ['Going too fast', 'Control each side and pause for a beat.']],
    breath: 'Out as you rotate to each side.', easy: 'dead_bug'
  },
  farmer: {
    f: [[0, 0, 0, 178, 178], [0, 0, 0, 178, 178]], l2: [{ to: [-12, 0], side: 1 }, { to: [12, 0], side: 1 }], eq: ['db@wrist'], ms: 600, hold: true, hl: ['fa'],
    steps: [
      { f: 0, t: 'Pick up a heavy weight in each hand. Stand tall, shoulders back and down.' },
      { f: 1, t: 'Walk with short, quick steps. Do not let the weights swing.' },
      { f: 1, t: 'Keep your ribs over the hips, chin level. Put them down with a flat back.' }
    ],
    feel: 'Grip, forearms, upper back and trunk.',
    err: [['Leaning to one side', 'Stand tall and keep the weights even.'], ['Shrugging the shoulders', 'Pull them down and back.'], ['Long strides', 'Short, quick steps. Breathe as you walk.']],
    breath: 'Breathe steadily. Do not hold your breath.'
  },

  // ---------------------------------------------------------------- cardio
  burpee: {
    f: [STAND, [32, -85, 70, 90, 90], [71.6, 71.6, 71.6, 180, 180, 150], [32, -85, 70, 90, 90], [0, 0, 0, 0, 0]],
    pin: 'ankle', at: [[0, 0], [0, 0], [-53.9, 0], [0, 0], [0, 12]], y: ['floor', 'floor', 'floor', 'floor', 'pin'],
    hand: [null, { to: [22, 0], side: -1 }, { to: [22, 0], side: -1 }, { to: [22, 0], side: -1 }, null], loop: 'wrap', ms: 520, hold: 120,
    steps: [
      { f: 0, t: 'Stand with your feet shoulder-width apart.' },
      { f: 1, t: 'Drop into a squat and put your hands on the floor.' },
      { f: 2, t: 'Jump or step your feet back to a plank. Add a push-up if you want.' },
      { f: 3, t: 'Jump or step your feet back in to your hands.' },
      { f: 4, t: 'Explode up into a small jump with your arms overhead. Land softly.' }
    ],
    feel: 'Everything: legs, chest, shoulders, heart rate.',
    err: [['Hips sag in the plank', 'Tighten the abs. Step instead of jumping if needed.'], ['Landing stiff-legged', 'Land softly with bent knees.'], ['Rushing and losing form', 'A steady pace beats a messy sprint.']],
    breath: 'Out as you jump, in as you drop down.', easy: 'mtn_climb'
  },
  mtn_climb: {
    f: [[71.6, 71.6, 71.6, 180, 180, 150], [76, -60, 71.6, 180, 180, 150]], pin: 'hip', at: [47.4, 23.6], y: 'pin',
    hand: { to: [75.9, 0], side: -1 }, l2: [{ to: [52, 6], side: 1 }, { to: [0, 7.8], side: 1 }], ms: 420, hold: 40, hl: ['thigh'],
    steps: [
      { f: 0, t: 'Start in a high plank, hands under shoulders, body in one line.' },
      { f: 1, t: 'Drive one knee toward your chest, then switch legs quickly, like running horizontally.' },
      { f: 0, t: 'Keep your hips low and your shoulders over your hands. Run steadily.' }
    ],
    feel: 'Core, shoulders and legs working together.',
    err: [['Hips pike up', 'Keep them level with the shoulders.'], ['Shoulders drift behind the hands', 'Stack the shoulders over the hands.'], ['Bouncing the head', 'Look at the floor between your hands.']],
    breath: 'Breathe in a quick, steady rhythm.', easy: 'plank'
  },
  jump_rope: {
    f: [[0, 0, 0, 165, 70, 90], [0, 0, 0, 165, 70, 125]], pin: 'ankle', at: [[0, 0], [0, 6]], y: ['floor', 'pin'], ms: 260, hold: 60,
    steps: [
      { f: 0, t: 'Elbows by your ribs, hands out at hip height. Stand tall.' },
      { f: 1, t: 'Hop just high enough for the rope to pass, a finger or two off the floor.' },
      { f: 0, t: 'Land softly on the balls of the feet. Turn the rope with your wrists, not the arms.' }
    ],
    feel: 'Calves, shoulders and your breathing.',
    err: [['Jumping too high', 'Tiny hops. Think skimming the floor.'], ['Big arm circles', 'Elbows stay at your sides; the wrists turn the rope.'], ['Landing on the heels', 'Stay on the balls of the feet.']],
    breath: 'Breathe steadily. Try nose in, mouth out.'
  },
  row_erg: {
    f: [[-25, -120, 20, 85, 85], [-80, -88, -25, 85, 85]], hand: [{ rel: [30, -14], side: -1 }, { rel: [8, -8], side: -1 }], eq: ['seat', 'grip@wrist', 'cable@wrist', 'rail'], cable: [26, 16], hold: true, ms: 1400, hl: ['thigh'],
    steps: [
      { f: 0, t: 'Catch: shins vertical, arms straight, leaning forward slightly.' },
      { f: 1, t: 'Drive: push with the legs first, then swing back, and then pull the arms in.' },
      { f: 1, t: 'Finish: legs straight, slight lean back, handle at the lower ribs.' },
      { f: 0, t: 'Recover in reverse: arms away, lean forward, then bend the knees.' }
    ],
    feel: 'Legs first, then back and arms. It should feel like a full-body push.',
    err: [['Pulling with the arms first', 'Legs, then body, then arms. Reverse that on the way back.'], ['Rounded back at the catch', 'Sit tall and hinge from the hips.'], ['Rushing the recovery', 'Take about twice as long to come forward as to drive.']],
    breath: 'Out on the drive, in on the recovery.'
  }
}
