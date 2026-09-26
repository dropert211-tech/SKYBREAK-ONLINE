// SKYBREAK auxiliary system 01
// Extension module: reusable gameplay configuration and helpers.
export const SYSTEM_INFO = {
  id: "system_01",
  version: "0.1",
  category: "arcade",
};

export function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export function smooth(current, target, rate, dt) {
  const k = 1 - Math.exp(-Math.max(0, rate) * Math.max(0, dt));
  return current + (target - current) * k;
}

export function lerpVec3(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export const PROFILE_01 = {
  label: "Arcade profile 01-01",
  acceleration: 11.25,
  maxSpeed: 20,
  turnRate: 0.92,
  boost: 1.15,
  energy: 62,
};

export const PROFILE_02 = {
  label: "Arcade profile 01-02",
  acceleration: 12.5,
  maxSpeed: 22,
  turnRate: 1.04,
  boost: 1.30,
  energy: 64,
};

export const PROFILE_03 = {
  label: "Arcade profile 01-03",
  acceleration: 13.75,
  maxSpeed: 24,
  turnRate: 1.16,
  boost: 1.45,
  energy: 66,
};

export const PROFILE_04 = {
  label: "Arcade profile 01-04",
  acceleration: 15.0,
  maxSpeed: 26,
  turnRate: 1.28,
  boost: 1.60,
  energy: 68,
};

export const PROFILE_05 = {
  label: "Arcade profile 01-05",
  acceleration: 16.25,
  maxSpeed: 28,
  turnRate: 1.40,
  boost: 1.00,
  energy: 70,
};

export const PROFILE_06 = {
  label: "Arcade profile 01-06",
  acceleration: 17.5,
  maxSpeed: 30,
  turnRate: 1.52,
  boost: 1.15,
  energy: 72,
};

export const PROFILE_07 = {
  label: "Arcade profile 01-07",
  acceleration: 18.75,
  maxSpeed: 32,
  turnRate: 0.80,
  boost: 1.30,
  energy: 74,
};

export const PROFILE_08 = {
  label: "Arcade profile 01-08",
  acceleration: 10.0,
  maxSpeed: 34,
  turnRate: 0.92,
  boost: 1.45,
  energy: 76,
};

export const PROFILE_09 = {
  label: "Arcade profile 01-09",
  acceleration: 11.25,
  maxSpeed: 36,
  turnRate: 1.04,
  boost: 1.60,
  energy: 78,
};

export const PROFILE_10 = {
  label: "Arcade profile 01-10",
  acceleration: 12.5,
  maxSpeed: 38,
  turnRate: 1.16,
  boost: 1.00,
  energy: 80,
};

export const PROFILE_11 = {
  label: "Arcade profile 01-11",
  acceleration: 13.75,
  maxSpeed: 18,
  turnRate: 1.28,
  boost: 1.15,
  energy: 82,
};

export const PROFILE_12 = {
  label: "Arcade profile 01-12",
  acceleration: 15.0,
  maxSpeed: 20,
  turnRate: 1.40,
  boost: 1.30,
  energy: 84,
};

export const PROFILE_13 = {
  label: "Arcade profile 01-13",
  acceleration: 16.25,
  maxSpeed: 22,
  turnRate: 1.52,
  boost: 1.45,
  energy: 86,
};

export const PROFILE_14 = {
  label: "Arcade profile 01-14",
  acceleration: 17.5,
  maxSpeed: 24,
  turnRate: 0.80,
  boost: 1.60,
  energy: 88,
};

export const PROFILE_15 = {
  label: "Arcade profile 01-15",
  acceleration: 18.75,
  maxSpeed: 26,
  turnRate: 0.92,
  boost: 1.00,
  energy: 90,
};

export const PROFILE_16 = {
  label: "Arcade profile 01-16",
  acceleration: 10.0,
  maxSpeed: 28,
  turnRate: 1.04,
  boost: 1.15,
  energy: 92,
};

export const PROFILE_17 = {
  label: "Arcade profile 01-17",
  acceleration: 11.25,
  maxSpeed: 30,
  turnRate: 1.16,
  boost: 1.30,
  energy: 94,
};

export const PROFILE_18 = {
  label: "Arcade profile 01-18",
  acceleration: 12.5,
  maxSpeed: 32,
  turnRate: 1.28,
  boost: 1.45,
  energy: 96,
};

export const PROFILE_19 = {
  label: "Arcade profile 01-19",
  acceleration: 13.75,
  maxSpeed: 34,
  turnRate: 1.40,
  boost: 1.60,
  energy: 98,
};

export const PROFILE_20 = {
  label: "Arcade profile 01-20",
  acceleration: 15.0,
  maxSpeed: 36,
  turnRate: 1.52,
  boost: 1.00,
  energy: 100,
};

export const PROFILE_21 = {
  label: "Arcade profile 01-21",
  acceleration: 16.25,
  maxSpeed: 38,
  turnRate: 0.80,
  boost: 1.15,
  energy: 102,
};

export const PROFILE_22 = {
  label: "Arcade profile 01-22",
  acceleration: 17.5,
  maxSpeed: 18,
  turnRate: 0.92,
  boost: 1.30,
  energy: 104,
};

export const PROFILE_23 = {
  label: "Arcade profile 01-23",
  acceleration: 18.75,
  maxSpeed: 20,
  turnRate: 1.04,
  boost: 1.45,
  energy: 106,
};

export const PROFILE_24 = {
  label: "Arcade profile 01-24",
  acceleration: 10.0,
  maxSpeed: 22,
  turnRate: 1.16,
  boost: 1.60,
  energy: 108,
};

export const PROFILE_25 = {
  label: "Arcade profile 01-25",
  acceleration: 11.25,
  maxSpeed: 24,
  turnRate: 1.28,
  boost: 1.00,
  energy: 110,
};
