import {MODULES, REACTORS, SERVICE, VESSEL} from './data/equipment.js';
import {ITEMS} from './data/items.js';
import {INTACT_THRESHOLD, OPERATIONS, RADIATION_WEAR_PER_MINUTE, RADIATION_WINDOW} from './data/operations.js';
import {ORRIN_DEAL_BONUS} from './data/comms.js';

// Pure game rules shared by every screen, so the map, the vessel, the bench,
// the operation and the hold always agree. `state` is the persisted game state.

export const reactorOutput = (state) => REACTORS[state.reactor]?.output ?? REACTORS.core82.output;
export const powerDraw = (moduleId) => VESSEL.baseLoad + MODULES[moduleId].power;
export const powerReserve = (moduleId, state) => reactorOutput(state) - powerDraw(moduleId);
export const fitsReactor = (moduleId, state) => powerReserve(moduleId, state) >= 0;
export const dryMass = (moduleId) => Math.round((VESSEL.hullMass + MODULES[moduleId].mass) * 10) / 10;
export const capability = (moduleId, key) => MODULES[moduleId]?.capabilities[key] ?? 0;

// ---- Hold ------------------------------------------------------------------------
export const holdMass = (state) => Math.round(state.hold.reduce((sum, entry) => sum + ITEMS[entry.id].mass * entry.qty, 0) * 100) / 100;
export const holdFree = (state) => Math.round((VESSEL.cargoCapacity - holdMass(state)) * 100) / 100;
export const itemValue = (id, state) => {
  const item = ITEMS[id];
  const deal = state.flags?.orrinDeal && (id === 'courierPlate' || id === 'scrapPlate');
  return Math.round(item.value * (deal ? 1 + ORRIN_DEAL_BONUS : 1));
};
export const holdValue = (state) => state.hold.reduce((sum, entry) => sum + itemValue(entry.id, state) * entry.qty, 0);

// ---- Route and services ---------------------------------------------------------------
// Round-trip propellant as a share of the tank; a heavier fit costs more.
export const routeFuel = (contract, moduleId) => Math.round(contract.distance * 0.52 * dryMass(moduleId) / 14.2);
export const transferMinutes = (contract) => Math.round(contract.distance * 0.7);
export const repairCost = (state) => Math.round((100 - state.hull) * SERVICE.repairPerPoint);
export const refuelCost = (state) => Math.round((100 - state.fuel) * SERVICE.fuelPerPoint);

// ---- Contract readiness ---------------------------------------------------------------
export function checkRequirement(requirement, state) {
  const value = capability(state.installed, requirement.capability);
  if (value >= requirement.min) return {state: 'met', requirement, value, module: state.installed};
  const capable = state.owned.filter(id => capability(id, requirement.capability) >= requirement.min);
  const fitting = capable.find(id => fitsReactor(id, state));
  if (fitting) return {state: 'refit', requirement, value, module: fitting};
  if (capable.length) return {state: 'blocked', requirement, value, module: capable[0], reason: 'power', need: powerDraw(capable[0])};
  return {state: 'blocked', requirement, value, module: null, reason: 'none'};
}

// status: 'ready', 'refit' (an owned module fixes it), 'service' (fuel, hull or
// hold space needs attention at the yard) or 'blocked' (nothing on board can).
export function assessContract(contract, state) {
  const checks = contract.requires.map(r => checkRequirement(r, state));
  const refit = checks.find(c => c.state === 'refit');
  const plannedFit = refit ? refit.module : state.installed;
  const fuel = routeFuel(contract, state.installed);
  const plannedFuel = routeFuel(contract, plannedFit);
  const free = holdFree(state);
  const cargo = {ok: contract.cargo <= free, free, need: contract.cargo};
  const fuelCheck = {ok: plannedFuel <= state.fuel, need: plannedFuel, have: state.fuel};
  const hullCheck = {ok: state.hull >= SERVICE.minHullToLaunch, have: state.hull};
  const blockedBy = checks.find(c => c.state === 'blocked') ?? null;
  let status = 'ready';
  if (blockedBy || contract.cargo > VESSEL.cargoCapacity) status = 'blocked';
  else if (refit) status = 'refit';
  else if (!cargo.ok || !fuelCheck.ok || !hullCheck.ok) status = 'service';
  return {status, checks, cargo, fuelCheck, hullCheck, refitModule: refit?.module ?? null, blockedBy, fuel, plannedFuel, minutes: transferMinutes(contract)};
}

export const moduleSuits = (moduleId, contract) => contract.requires.every(r => capability(moduleId, r.capability) >= r.min);
export const visibleContracts = (contracts, state) => contracts.filter(c => state.contracts[c.id] && state.contracts[c.id] !== 'hidden');

// ---- Operation -----------------------------------------------------------------------------
export const operationSteps = (contractId) => OPERATIONS[contractId] ?? [];

export function optionAvailability(option, operation, state) {
  if (option.requires && capability(state.installed, option.requires.capability) < option.requires.min) {
    return {ok: false, reason: 'tool', requires: option.requires};
  }
  if ((option.fuel ?? 0) > operation.stats.fuel) return {ok: false, reason: 'fuel', need: option.fuel, have: operation.stats.fuel};
  return {ok: true};
}

export function startOperation(contract, state) {
  return {
    contract: contract.id, step: 0, choices: [],
    stats: {minutes: 0, fuel: state.fuel, hull: state.hull, integrity: 100, onSite: 0, tonnage: 0, rate: 0, rewardFactor: 1, items: []},
  };
}

export function applyOption(operation, option) {
  const s = {...operation.stats, items: [...operation.stats.items]};
  s.minutes += option.minutes ?? 0;
  s.fuel = Math.max(0, s.fuel - (option.fuel ?? 0));
  s.hull = Math.max(0, s.hull + (option.hull ?? 0));
  s.integrity = Math.max(0, s.integrity + (option.integrity ?? 0));
  s.onSite += option.onSite ?? 0;
  if (option.tonnage) { s.tonnage = option.tonnage; s.rate = option.rate; }
  if (option.rewardFactor) s.rewardFactor = option.rewardFactor;
  for (const [id, qty] of option.items ?? []) s.items.push([id, qty]);
  return {...operation, step: operation.step + 1, choices: [...operation.choices, option.id], stats: s};
}

// Final settlement: payment, wear, items and what could not be stowed.
export function settle(contract, operation, state) {
  const s = operation.stats;
  const radiation = contract.id === 'brine' ? Math.max(0, s.onSite - RADIATION_WINDOW) * RADIATION_WEAR_PER_MINUTE : 0;
  const hull = Math.max(0, Math.round(s.hull - radiation));
  const base = contract.payout === 'tonnage' ? s.tonnage * s.rate : Math.round(contract.reward * s.rewardFactor);
  const bonus = contract.bonus && s.integrity >= INTACT_THRESHOLD ? contract.bonus : 0;
  let free = holdFree(state);
  const stowed = [], left = [];
  for (const [id, qty] of s.items) {
    const fit = Math.min(qty, Math.floor((free + 1e-6) / ITEMS[id].mass));
    if (fit > 0) { stowed.push([id, fit]); free -= fit * ITEMS[id].mass; }
    if (qty - fit > 0) left.push([id, qty - fit]);
  }
  return {
    contract: contract.id, base, bonus, payout: base + bonus,
    minutes: s.minutes, fuelBefore: state.fuel, fuel: s.fuel, hullBefore: state.hull, hull, radiation: Math.round(radiation),
    integrity: s.integrity, intact: s.integrity >= INTACT_THRESHOLD, tonnage: s.tonnage, stowed, left, choices: operation.choices,
  };
}
