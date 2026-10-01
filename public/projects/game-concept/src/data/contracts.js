// Contracts on the Lacuna ring. Positions are polar coordinates on the sector
// map (angle in degrees around Morrow, radius in map units, height above the
// ring plane). Text for each contract lives in the locale files under its id.
// `payout` is either a fixed reward or 'tonnage' (paid per tonne delivered).

export const HOME = {id: 'yard', angle: -102, radius: 41, height: 0.4};

export const CLIENTS = {
  halden: {id: 'halden', name: 'Halden Mutual', contact: 'Ines Varga'},
  orrin: {id: 'orrin', name: 'Orrin Salvage Co-op', contact: 'Tamsin Orr'},
  cassel: {id: 'cassel', name: 'Cassel Assay', contact: 'Dr. Aurel Moss'},
  traffic: {id: 'traffic', name: 'Morrow Traffic Control', contact: 'Dispatcher Kade'},
  yard: {id: 'yard', name: 'Kepler Yard', contact: 'Yardmaster Oyelaran'},
};

export const CONTRACTS = [
  {
    id: 'nacre', name: 'NACRE–9', client: 'halden', kind: 'recovery', wreck: 'courier',
    distance: 38, reward: 14500, bonus: 2000, cargo: 3.2, deadlineHours: 36,
    requires: [{capability: 'tow', min: 4}],
    risks: [{id: 'tumble', level: 2}, {id: 'debris', level: 2}],
    objectives: ['fit', 'stabilize', 'extract', 'deliver'], bonusObjective: 'intact',
    map: {angle: -47, radius: 44, height: 1.6},
  },
  {
    id: 'tallow', name: 'TALLOW REACH', client: 'orrin', kind: 'salvage', wreck: 'freighter',
    distance: 22, reward: 9000, payout: 'tonnage', bonus: 0, cargo: 11, deadlineHours: 72,
    requires: [{capability: 'cutDepth', min: 30}],
    risks: [{id: 'debris', level: 1}],
    objectives: ['fit', 'cut', 'deliver'],
    map: {angle: -72, radius: 38.5, height: -0.8},
  },
  {
    id: 'brine', name: 'BRINE HOLLOW', client: 'cassel', kind: 'breach', wreck: 'platform',
    distance: 61, reward: 31000, bonus: 0, cargo: 2.4, deadlineHours: 96,
    requires: [{capability: 'cutDepth', min: 80}],
    risks: [{id: 'radiation', level: 3}, {id: 'debris', level: 2}],
    objectives: ['fit', 'breach', 'extract', 'deliver'],
    map: {angle: -28, radius: 47.5, height: 2.4},
  },
  {
    id: 'beacon', name: 'K–17', client: 'traffic', kind: 'service', wreck: 'beacon',
    distance: 12, reward: 3400, bonus: 0, cargo: 1.5, deadlineHours: 12,
    requires: [],
    risks: [{id: 'debris', level: 1}],
    objectives: ['swap', 'deliver'],
    map: {angle: -89, radius: 45.5, height: 1.1},
  },
  {
    // Revealed only if the player tells Halden what the recorder shows.
    id: 'seraph', name: 'SERAPH–2', client: 'halden', kind: 'recovery', wreck: 'lifeboat', hidden: true,
    distance: 29, reward: 7800, bonus: 0, cargo: 2.1, deadlineHours: 24,
    requires: [{capability: 'tow', min: 2}],
    risks: [{id: 'debris', level: 1}],
    objectives: ['fit', 'extract', 'deliver'],
    map: {angle: -58, radius: 50, height: 3.2},
  },
];

export const contractById = (id) => CONTRACTS.find(c => c.id === id);
