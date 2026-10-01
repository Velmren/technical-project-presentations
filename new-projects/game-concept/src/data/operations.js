// Compressed recovery operations. Each contract runs a short sequence of
// steps; every step offers options whose costs are shown before choosing.
// Effects are deterministic: minutes, fuel (% of tank), hull (%),
// integrity (% of the cargo's condition), items gained, tonnage delivered.
// `requires` gates an option on a capability of the installed module.

const APPROACH = {
  id: 'approach',
  options: [
    {id: 'direct', minutes: 18, fuel: 8, hull: -4},
    {id: 'around', minutes: 30, fuel: 11, hull: 0},
  ],
};
const RETURN = {
  id: 'return',
  options: [
    {id: 'standard', minutes: 26, fuel: 10},
    {id: 'fast', minutes: 16, fuel: 16},
  ],
};

export const OPERATIONS = {
  nacre: [
    APPROACH,
    {id: 'stabilize', options: [
      {id: 'winch', minutes: 14, fuel: 2, requires: {capability: 'cable', min: 100}},
      {id: 'claw', minutes: 5, fuel: 1, hull: -3, integrity: -15},
    ]},
    {id: 'extract', options: [
      {id: 'nose', minutes: 10, fuel: 6, items: [['courierPlate', 1], ['avionics', 1]]},
      {id: 'mount', minutes: 6, integrity: -30},
    ]},
    RETURN,
  ],
  seraph: [
    {id: 'approach', options: [
      {id: 'direct', minutes: 16, fuel: 6, hull: -2},
      {id: 'around', minutes: 24, fuel: 8, hull: 0},
    ]},
    {id: 'extract', options: [
      {id: 'winch', minutes: 12, fuel: 3, requires: {capability: 'cable', min: 100}},
      {id: 'claw', minutes: 6, fuel: 2, integrity: -20},
    ]},
    RETURN,
  ],
  tallow: [
    {id: 'approach', options: [
      {id: 'direct', minutes: 14, fuel: 5, hull: -1},
      {id: 'around', minutes: 20, fuel: 7, hull: 0},
    ]},
    {id: 'cut', options: [
      {id: 'precise', minutes: 40, tonnage: 9, rate: 1050},
      {id: 'fast', minutes: 22, tonnage: 11, rate: 780, hull: -1},
    ]},
    {id: 'extra', options: [
      {id: 'coolant', minutes: 12, items: [['coolant', 2]]},
      {id: 'leave', minutes: 0},
    ]},
    RETURN,
  ],
  beacon: [
    {id: 'approach', options: [
      {id: 'lane', minutes: 12, fuel: 3},
      {id: 'direct', minutes: 9, fuel: 4, hull: -1},
    ]},
    {id: 'swap', options: [
      {id: 'auto', minutes: 12},
      {id: 'manual', minutes: 20, items: [['beaconCore', 1]]},
    ]},
    {id: 'return', options: [{id: 'standard', minutes: 10, fuel: 4}]},
  ],
  brine: [
    {id: 'approach', options: [
      {id: 'direct', minutes: 16, fuel: 7, hull: -2},
      {id: 'around', minutes: 24, fuel: 9, hull: 0},
    ]},
    {id: 'breach', options: [
      {id: 'full', minutes: 6, hull: -3, onSite: 6},
      {id: 'pulse', minutes: 14, onSite: 14},
    ]},
    {id: 'extract', options: [
      {id: 'all', minutes: 8, onSite: 8},
      {id: 'sealed', minutes: 3, onSite: 3, rewardFactor: 0.7},
    ]},
    RETURN,
  ],
};

// Radiation at BRINE HOLLOW: minutes on site beyond the window wear the hull.
export const RADIATION_WINDOW = 20;
export const RADIATION_WEAR_PER_MINUTE = 0.5;
export const INTACT_THRESHOLD = 80;
