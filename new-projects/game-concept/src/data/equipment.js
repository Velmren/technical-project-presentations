// MULE-06 base systems, the reactors it can carry and the three utility
// modules. Capabilities are what contracts test against; the shared costs
// (power, mass, heat) are what every module adds to the vessel.

export const VESSEL = {
  name: 'MULE–06',
  hullMass: 12.8,       // t, without a utility module
  cargoCapacity: 18,    // t
  baseLoad: 24,         // kW: life support, drive control, sensors
  driveThrust: 120,     // kN
  buyout: 50000,        // cr: the yard's price for the vessel, the player's goal
};

export const REACTORS = {
  core82: {id: 'core82', name: 'ISOTOPE CORE R–1', output: 82, price: 0},
  core96: {id: 'core96', name: 'ISOTOPE CORE R–2', output: 96, price: 24000},
};

// Yard services, per percentage point.
export const SERVICE = {repairPerPoint: 120, fuelPerPoint: 60, minHullToLaunch: 40};

export const MODULES = {
  cutter: {
    id: 'cutter', name: 'KESTREL C–8', short: 'KESTREL', type: 'cutter',
    mass: 1.4, power: 38, heat: 44,
    capabilities: {cutDepth: 42, cutRate: 1.8},
  },
  grapple: {
    id: 'grapple', name: 'LATCH G–2', short: 'LATCH', type: 'grapple',
    mass: 2.6, power: 24, heat: 18,
    capabilities: {tow: 18, jawSpan: 2.1, cable: 140},
  },
  arc: {
    id: 'arc', name: 'HELIOS A–9', short: 'HELIOS', type: 'array',
    mass: 3.8, power: 68, heat: 88,
    capabilities: {cutDepth: 96, cutRate: 0.6},
  },
};

export const MODULE_ORDER = ['cutter', 'grapple', 'arc'];

// Units per capability; labels live in the locale files.
export const CAPABILITY_UNITS = {cutDepth: 'mm', cutRate: 'mPerMin', tow: 't', jawSpan: 'm', cable: 'm'};
