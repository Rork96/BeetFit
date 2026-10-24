// Camera-trackable exercises. MediaPipe Pose landmark indices:
// 11/12 shoulder · 13/14 elbow · 15/16 wrist · 23/24 hip · 25/26 knee · 27/28 ankle (L/R).
//
// mode 'reps':
//   dir 'close' — joint angle CLOSES at the hard part (squat, push-up, curl). Rest = angle > up,
//                 bottom = angle < down. A rep counts when you return to rest.
//   dir 'open'  — joint angle OPENS at the hard part (bridge, press). Rest = angle < down,
//                 top = angle > up. A rep counts when you return to rest.
//   target — the angle a full-range rep should reach (used for depth score + live range bar).
// mode 'hold': `inPos(angles)` decides whether the position is held; the timer only runs while true.
//
// pick: 'best' = use the side with higher landmark visibility (side-on exercises)
//       'both' = average L and R, also gives a symmetry reading (face-on exercises)
//       'min'  = the smaller of L and R (lunge: the front knee bends most)

const L = { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 }
const R = { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28 }
const tri = (a, b, c) => ({ L: [L[a], L[b], L[c]], R: [R[a], R[b], R[c]] })

export const EXERCISES = {
  squat: {
    name: 'Squat', mode: 'reps', view: 'side', pick: 'best',
    joint: tri('hip', 'knee', 'ankle'), dir: 'close', down: 105, up: 160, target: 90,
    setup: 'Side-on, phone at hip height, about 2 m away. Whole body in frame.',
    cue: '3 seconds down. Knees track over toes. Chest up.'
  },
  pushup: {
    name: 'Push-up', mode: 'reps', view: 'side', pick: 'best',
    joint: tri('shoulder', 'elbow', 'wrist'), dir: 'close', down: 100, up: 155, target: 85,
    align: { joint: tri('shoulder', 'hip', 'ankle'), min: 160, label: 'Body line' },
    setup: 'Side-on, phone on the floor about 1.5 m away. Head to feet in frame.',
    cue: 'Body one straight line. Elbows at 45°.'
  },
  lunge: {
    name: 'Reverse lunge', mode: 'reps', view: 'side', pick: 'min',
    joint: tri('hip', 'knee', 'ankle'), dir: 'close', down: 110, up: 155, target: 95,
    setup: 'Side-on, whole body in frame. Alternate legs or finish one side first.',
    cue: 'Knee kisses the floor. Front heel drives you up.'
  },
  bridge: {
    name: 'Glute bridge', mode: 'reps', view: 'side', pick: 'best',
    joint: tri('shoulder', 'hip', 'knee'), dir: 'open', down: 145, up: 165, target: 172,
    setup: 'Side-on, phone on the floor about 1.5 m away. Shoulders to feet in frame.',
    cue: 'Squeeze at the top for 2 seconds. Ribs down.'
  },
  rdl: {
    name: 'Romanian deadlift', mode: 'reps', view: 'side', pick: 'best',
    joint: tri('shoulder', 'hip', 'knee'), dir: 'close', down: 125, up: 165, target: 100,
    setup: 'Side-on, whole body in frame.',
    cue: 'Hips back, soft knees. Bar close to the legs.'
  },
  curl: {
    name: 'Biceps curl', mode: 'reps', view: 'front', pick: 'both',
    joint: tri('shoulder', 'elbow', 'wrist'), dir: 'close', down: 65, up: 145, target: 45,
    setup: 'Face the camera, both arms visible from shoulder to wrist.',
    cue: 'Elbows pinned to your sides. No swing.'
  },
  press: {
    name: 'Overhead press', mode: 'reps', view: 'front', pick: 'both',
    joint: tri('shoulder', 'elbow', 'wrist'), dir: 'open', down: 115, up: 160, target: 172,
    setup: 'Face the camera, arms visible all the way overhead.',
    cue: 'Ribs down, glutes tight. Press slightly back.'
  },
  plank: {
    name: 'Plank', mode: 'hold', view: 'side', pick: 'best',
    joint: tri('shoulder', 'hip', 'ankle'),
    inPos: ({ angle, torsoTilt }) => angle >= 155 && torsoTilt <= 40,
    quality: ({ angle }) => clamp01((angle - 140) / 35),
    setup: 'Side-on, phone on the floor about 1.5 m away. Head to feet in frame.',
    cue: "Glutes tight, ribs down. Don't let hips sag."
  },
  wallsit: {
    name: 'Wall sit', mode: 'hold', view: 'side', pick: 'best',
    joint: tri('hip', 'knee', 'ankle'),
    inPos: ({ angle }) => angle >= 70 && angle <= 120,
    quality: ({ angle }) => clamp01(1 - Math.abs(angle - 90) / 35),
    setup: 'Side-on, whole body in frame.',
    cue: 'Thighs parallel, whole back on the wall. Breathe.'
  }
}

// Library exercise name → tracker id. Exercises not listed fall back to manual counting.
export const TRACKER_BY_NAME = {
  'Bodyweight squats': 'squat', 'Bodyweight squat': 'squat', Squats: 'squat', 'Squats (goblet)': 'squat',
  'Squats (tempo)': 'squat', 'Goblet squat': 'squat', 'Squat to press': 'squat', 'Wall sit': 'wallsit',
  'Push-ups': 'pushup', 'Push-up': 'pushup', 'Incline push-ups': 'pushup', 'Push-ups (weighted if easy)': 'pushup',
  'Lunges': 'lunge', 'Lunges (each leg)': 'lunge', 'Reverse lunge': 'lunge', 'Bulgarian split squat': 'lunge',
  'Glute bridges': 'bridge', 'Glute bridge': 'bridge', 'Hip thrusts': 'bridge', 'Hip thrust': 'bridge',
  'Romanian deadlift': 'rdl',
  'Dumbbell curls': 'curl', 'Hammer curls': 'curl', 'Biceps curl': 'curl', 'Hammer curl': 'curl',
  'Overhead press': 'press', 'Band overhead press': 'press',
  'Back squat': 'squat', 'Walking lunges': 'lunge',
  Plank: 'plank'
}

export function clamp01(v) { return Math.max(0, Math.min(1, v)) }
