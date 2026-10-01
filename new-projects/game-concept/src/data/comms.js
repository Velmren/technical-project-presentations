// Client messages. A message arrives when its trigger fires (game start,
// a contract accepted or completed). Choices carry their consequences, shown
// to the player before they reply; text lives in the locale files.

export const MESSAGES = [
  {id: 'yardWelcome', from: 'yard', trigger: {start: true}},
  {id: 'haldenBrief', from: 'halden', trigger: {accepted: 'nacre'}},
  {id: 'casselBrief', from: 'cassel', trigger: {accepted: 'brine'}},
  {
    id: 'haldenAfter', from: 'halden', trigger: {completed: 'nacre'},
    choices: [
      {id: 'seal', effects: {credits: 1000, reputation: {halden: 1}}},
      {id: 'hatch', effects: {reputation: {halden: 1}, reveal: 'seraph'}},
      {id: 'copy', effects: {credits: 3000, reputation: {halden: -2}, flag: 'haldenClosed'}},
    ],
  },
  {
    id: 'orrinAfter', from: 'orrin', trigger: {completed: 'tallow'},
    choices: [
      {id: 'exclusive', effects: {reputation: {orrin: 1}, flag: 'orrinDeal'}},
      {id: 'decline', effects: {}},
    ],
  },
  {
    id: 'trafficAfter', from: 'traffic', trigger: {completed: 'beacon'},
    choices: [
      {id: 'fuel', effects: {fuel: 20}},
      {id: 'credits', effects: {credits: 800}},
    ],
  },
  {id: 'haldenSeraph', from: 'halden', trigger: {completed: 'seraph'}},
];

export const messageById = (id) => MESSAGES.find(m => m.id === id);

// Plating sells for more once the co-op deal is signed.
export const ORRIN_DEAL_BONUS = 0.15;
