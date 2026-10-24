// Parametric front-view human silhouette (Pavlo's bodyShape.ts, ported to JS). No dependencies.
// Coordinates: x centred on 0 (≈ -80..80), y from 0 (top of head) to ≈430 (soles).


export const VIEWBOX = { x: -82, y: -4, w: 164, h: 440 };

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- weight → shape ----------

export const bmi = (kg, heightCm) => kg / (heightCm / 100) ** 2;

export const fatFromBmi = (b, sex) =>
  sex === 'male' ? clamp((b - 19) / 17) : clamp((b - 18) / 17);

export const defaultMuscle = (sex) => (sex === 'male' ? 0.35 : 0.25);

/**
 * Shape for the start and target weight, plus a function that gives the shape for any weight
 * on the way. Gaining is modelled mostly as muscle, losing mostly as fat.
 */
export function bodyJourney(o) {
  const muscle0 = o.muscle ?? defaultMuscle(o.sex);
  const goal = o.goal && o.goal !== 'auto' ? o.goal : o.targetKg >= o.startKg ? 'gain' : 'lose';
  const fatAt = kg => fatFromBmi(bmi(kg, o.heightCm), o.sex);
  const start = { sex: o.sex, fat: fatAt(o.startKg), muscle: muscle0 };
  const dKg = o.targetKg - o.startKg;
  const target =
    goal === 'gain'
      ? {
          sex: o.sex,
          // ~70% of a lean bulk is drawn as muscle, the rest as fat
          muscle: clamp(muscle0 + Math.max(0, dKg) * 0.06),
          fat: clamp(start.fat + 0.3 * (fatAt(o.targetKg) - start.fat)),
        }
      : {
          sex: o.sex,
          muscle: clamp(muscle0 + 0.05), // looks more defined when lean
          fat: fatAt(o.targetKg),
        };
  const at = kg => {
    if (dKg === 0) return start;
    const t = (kg - o.startKg) / dKg;
    if (t >= 0 && t <= 1) return mixParams(start, target, t);
    // beyond the plan in either direction: follow BMI for fat, keep muscle clamped
    return {
      sex: o.sex,
      fat: fatAt(kg),
      muscle: clamp(lerp(start.muscle, target.muscle, clamp(t, -0.5, 1.5))),
    };
  };
  return { start, target, at, goal };
}

export const mixParams = (a, b, t) => ({
  sex: t < 0.5 ? a.sex : b.sex,
  fat: lerp(a.fat, b.fat, t),
  muscle: lerp(a.muscle, b.muscle, t),
});

/** 0..1 share of the way from start to target (clamped). */
export const progressShare = (startKg, currentKg, targetKg) =>
  targetKg === startKg ? 1 : clamp((currentKg - startKg) / (targetKg - startKg));

// ---------- geometry ----------

/** Closed Catmull-Rom spline through points → smooth SVG path. */
function smoothClosed(pts, tension = 0.5) {
  const n = pts.length;
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const k = tension / 3;
    const c1 = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2 = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += ` C ${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + " Z";
}
const f = v => (Math.round(v * 10) / 10).toString();

export function bodyShapes(p) {
  const F = p.sex === 'female' ? 1 : 0;
  const fa = clamp(p.fat);
  const m = clamp(p.muscle);

  // half-widths (right side, x > 0)
  const neck = 10.5 + 4 * fa + 2.5 * m - 1.5 * F;
  const traps = neck + 9 + 7 * m - 3 * F;
  const shoulder = 42 + 9 * m + 4 * fa - 7 * F;
  const chest = 33 + 6 * m + 9 * fa - 4 * F;
  const lowChest = F ? 32 + 12 * fa : 32 + 5 * m + 11 * fa;
  const waist = F ? 22 + 27 * fa + 1 * m : 25 + 3 * m + 30 * fa;
  const belly = F ? 29 + 24 * fa : 27 + 2 * m + 33 * fa;
  const hip = F ? 36 + 22 * fa : 30 + 2 * m + 22 * fa;
  const thigh = F ? 34 + 20 * fa + 2 * m : 29 + 4 * m + 19 * fa;
  const midThigh = 26 + 5 * m + 13 * fa + 2 * F;
  const knee = 21.5 + 2 * m + 6 * fa;
  const calf = 24 + 4 * m + 6 * fa - F;
  const lowCalf = 19 + 2 * m + 2 * fa - F;
  const crotchY = 244 - 4 * fa;
  const innerThigh = Math.max(0.6, 2.4 - 2 * fa);

  const right = [
    [neck - 0.5, 56],
    [neck + 0.8, 68],
    [neck + 6 + 2 * m, 78],
    [traps + 4, 85],
    [shoulder - 7, 91],
    [shoulder, 102],
    [shoulder - 3, 113],
    [chest, 124],
    [lowChest, 144],
    [waist, 180],
    [belly, 202],
    [hip, 224],
    [thigh, 252],
    [midThigh, 284],
    [knee, 320],
    [calf, 347],
    [lowCalf, 376],
    [14.5, 400],
    [17, 414],
    [15.5, 424],
    [9, 428],
    [4.5, 425],
    [5.5, 400],
    [4, 350],
    [3.5, 320],
    [innerThigh, 284],
    [0.2, crotchY + 2],
  ];
  const left = right.map(([x, y]) => [-x, y]).reverse();
  // left starts at crotch → up to neck; join right(neck→crotch) + left(crotch→neck)
  const torso = smoothClosed([...right, [0, crotchY], ...left.slice(0)]);

  // arms: bone polyline with half-widths
  const jx = shoulder - 8;
  const ex = shoulder + 5 + 10 * fa - 2 * F;
  const wx = shoulder + 10 + 13 * fa - 2 * F;
  const bone = [
    { x: jx, y: 98, w: 10 + 5 * m + 6 * fa - 2 * F },
    { x: lerp(jx, ex, 0.45), y: 135, w: 8 + 5 * m + 7 * fa - 1.5 * F },
    { x: ex, y: 172, w: 6.5 + 2 * m + 3 * fa },
    { x: lerp(ex, wx, 0.35), y: 192, w: 7.5 + 3.5 * m + 4.5 * fa - F },
    { x: wx, y: 232, w: 4.6 + 1 * fa },
    { x: wx + 1, y: 248, w: 6.5 },
  ];
  const outer = [];
  const inner = [];
  bone.forEach((b, i) => {
    const a = bone[Math.max(0, i - 1)];
    const c = bone[Math.min(bone.length - 1, i + 1)];
    const dx = c.x - a.x;
    const dy = c.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dy / len;
    const ny = -dx / len;
    outer.push([b.x + nx * b.w, b.y + ny * b.w]);
    inner.push([b.x - nx * b.w, b.y - ny * b.w]);
  });
  const top = [jx + 2, 98 - (10 + 5 * m) * 0.9];
  const tip = [wx + 1.5, 264];
  const armRpts = [top, ...outer, tip, ...inner.reverse()];
  const armR = smoothClosed(armRpts);
  const armL = smoothClosed(armRpts.map(([x, y]) => [-x, y]).reverse());

  const head = { cx: 0, cy: 34, rx: 18.5 + 3 * fa - 1 * F, ry: 24 + 0.5 * fa };

  const hair = F
    ? smoothClosed([
        [0, 7],
        [15, 10],
        [22, 24],
        [23, 46],
        [25, 66],
        [17, 70],
        [13, 50],
        [0, 22],
        [-13, 50],
        [-17, 70],
        [-25, 66],
        [-23, 46],
        [-22, 24],
        [-15, 10],
      ])
    : undefined;

  // muscle definition: pecs + abs, fades with fat
  const def = clamp((m - fa * 1.1) * 2.4, 0, 1);
  const pecY = 138 + 2 * fa;
  const definition = F
    ? `M -4 ${pecY + 4} Q -18 ${pecY + 8} -28 ${pecY - 4} M 4 ${pecY + 4} Q 18 ${pecY + 8} 28 ${pecY - 4}`
    : [
        `M -2 ${pecY - 18} Q -6 ${pecY} -2 ${pecY + 2} Q -18 ${pecY + 6} -30 ${pecY - 6}`,
        `M 2 ${pecY - 18} Q 6 ${pecY} 2 ${pecY + 2} Q 18 ${pecY + 6} 30 ${pecY - 6}`,
        `M 0 ${pecY + 8} L 0 210`,
        `M -13 ${pecY + 22} Q 0 ${pecY + 25} 13 ${pecY + 22}`,
        `M -13 ${pecY + 42} Q 0 ${pecY + 45} 13 ${pecY + 42}`,
        `M -12 ${pecY + 62} Q 0 ${pecY + 65} 12 ${pecY + 62}`,
      ].join(" ");

  return { torso, armL, armR, head, hair, definition, definitionOpacity: def * 0.55 };
}
