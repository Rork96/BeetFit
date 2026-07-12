// trackerId links an exercise to the camera pose tracker config
export const PROGRAMS = {
  lose: {
    name: 'Fat Loss — Full Body 3x/week',
    days: [
      {
        name: 'Day A — Lower + Cardio',
        exercises: [
          { name: 'Bodyweight squats', sets: 4, reps: 15, trackerId: 'squat' },
          { name: 'Lunges (each leg)', sets: 3, reps: 12 },
          { name: 'Glute bridges', sets: 3, reps: 15 },
          { name: 'Jumping jacks', sets: 3, reps: 30 },
          { name: 'Plank', sets: 3, reps: '45s' }
        ]
      },
      {
        name: 'Day B — Upper + Core',
        exercises: [
          { name: 'Push-ups', sets: 4, reps: 12 },
          { name: 'Dumbbell curls', sets: 3, reps: 12, trackerId: 'curl' },
          { name: 'Overhead press', sets: 3, reps: 12, trackerId: 'press' },
          { name: 'Mountain climbers', sets: 3, reps: 20 },
          { name: 'Crunches', sets: 3, reps: 20 }
        ]
      },
      {
        name: 'Day C — Intervals',
        exercises: [
          { name: 'Squat to press', sets: 4, reps: 12, trackerId: 'squat' },
          { name: 'Burpees', sets: 3, reps: 10 },
          { name: 'High knees', sets: 4, reps: '30s' },
          { name: 'Side plank (each side)', sets: 3, reps: '30s' }
        ]
      }
    ]
  },
  maintain: {
    name: 'Maintenance — Full Body 3x/week',
    days: [
      {
        name: 'Day A — Push',
        exercises: [
          { name: 'Push-ups', sets: 4, reps: 12 },
          { name: 'Overhead press', sets: 3, reps: 10, trackerId: 'press' },
          { name: 'Dips (chair)', sets: 3, reps: 10 },
          { name: 'Plank', sets: 3, reps: '60s' }
        ]
      },
      {
        name: 'Day B — Legs',
        exercises: [
          { name: 'Squats', sets: 4, reps: 12, trackerId: 'squat' },
          { name: 'Romanian deadlift', sets: 3, reps: 12 },
          { name: 'Calf raises', sets: 3, reps: 20 },
          { name: 'Wall sit', sets: 3, reps: '45s' }
        ]
      },
      {
        name: 'Day C — Pull + Arms',
        exercises: [
          { name: 'Rows (band/dumbbell)', sets: 4, reps: 12 },
          { name: 'Dumbbell curls', sets: 3, reps: 12, trackerId: 'curl' },
          { name: 'Reverse fly', sets: 3, reps: 15 },
          { name: 'Crunches', sets: 3, reps: 20 }
        ]
      }
    ]
  },
  gain: {
    name: 'Muscle Gain — Upper/Lower 4x/week',
    days: [
      {
        name: 'Day 1 — Upper strength',
        exercises: [
          { name: 'Push-ups (weighted if easy)', sets: 4, reps: 8 },
          { name: 'Overhead press', sets: 4, reps: 8, trackerId: 'press' },
          { name: 'Rows', sets: 4, reps: 10 },
          { name: 'Dumbbell curls', sets: 3, reps: 10, trackerId: 'curl' }
        ]
      },
      {
        name: 'Day 2 — Lower strength',
        exercises: [
          { name: 'Squats (goblet)', sets: 4, reps: 8, trackerId: 'squat' },
          { name: 'Romanian deadlift', sets: 4, reps: 10 },
          { name: 'Bulgarian split squat', sets: 3, reps: 10 },
          { name: 'Calf raises', sets: 4, reps: 15 }
        ]
      },
      {
        name: 'Day 3 — Upper volume',
        exercises: [
          { name: 'Incline push-ups', sets: 4, reps: 12 },
          { name: 'Lateral raises', sets: 4, reps: 15 },
          { name: 'Hammer curls', sets: 3, reps: 12, trackerId: 'curl' },
          { name: 'Plank', sets: 3, reps: '60s' }
        ]
      },
      {
        name: 'Day 4 — Lower volume',
        exercises: [
          { name: 'Squats (tempo)', sets: 4, reps: 12, trackerId: 'squat' },
          { name: 'Hip thrusts', sets: 4, reps: 12 },
          { name: 'Lunges', sets: 3, reps: 12 },
          { name: 'Crunches', sets: 3, reps: 20 }
        ]
      }
    ]
  }
}

// Pose tracker configs: joint triplets (MediaPipe landmark indices) + angle thresholds.
// Rep = angle passes below `down` then back above `up`.
export const TRACKERS = {
  squat: {
    name: 'Squat',
    joints: [24, 26, 28], // hip, knee, ankle (right side)
    altJoints: [23, 25, 27],
    down: 100,
    up: 160,
    hint: 'Stand sideways to the camera, full body in frame'
  },
  curl: {
    name: 'Biceps curl',
    joints: [12, 14, 16], // shoulder, elbow, wrist
    altJoints: [11, 13, 15],
    down: 60,
    up: 150,
    inverted: true, // rep = angle closes then opens
    hint: 'Face the camera, arm fully visible'
  },
  press: {
    name: 'Overhead press',
    joints: [12, 14, 16],
    altJoints: [11, 13, 15],
    down: 100,
    up: 160,
    hint: 'Face the camera, arms visible above head'
  }
}
