// Things that end up in the hold. Each item has its own 3D thumbnail
// (`model`), a purpose that decides what can be done with it, and a value.
// `strip` lists what the item breaks down into on the yard's bench.

export const ITEMS = {
  courierPlate: {id: 'courierPlate', model: 'plate', kind: 'salvage', mass: 2.6, value: 1400, strip: [['alloy', 3]]},
  scrapPlate: {id: 'scrapPlate', model: 'plateBundle', kind: 'salvage', mass: 1.0, value: 520, strip: [['alloy', 2]]},
  avionics: {id: 'avionics', model: 'rack', kind: 'salvage', mass: 0.4, value: 2200, strip: [['boards', 4]]},
  beaconCore: {id: 'beaconCore', model: 'core', kind: 'salvage', mass: 0.8, value: 900, strip: [['boards', 2], ['alloy', 1]]},
  coolant: {id: 'coolant', model: 'canister', kind: 'hazard', mass: 0.3, value: 600, strip: null},
  alloy: {id: 'alloy', model: 'ingots', kind: 'material', mass: 0.5, value: 300, strip: null},
  boards: {id: 'boards', model: 'boards', kind: 'material', mass: 0.05, value: 250, strip: null},
};

export const ITEM_ORDER = ['avionics', 'courierPlate', 'scrapPlate', 'beaconCore', 'coolant', 'alloy', 'boards'];
