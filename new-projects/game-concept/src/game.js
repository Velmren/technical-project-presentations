import {CONTRACTS, contractById} from './data/contracts.js';
import {ITEMS} from './data/items.js';
import {REACTORS, SERVICE, VESSEL} from './data/equipment.js';
import {MESSAGES, messageById} from './data/comms.js';
import {applyOption, assessContract, fitsReactor, holdFree, itemValue, operationSteps, optionAvailability, refuelCost, repairCost, settle, startOperation} from './rules.js';

// Game actions. Each one validates against the rules, mutates the store in a
// single update, writes the log and delivers any client message it triggers.
// They return a small result object the interface turns into feedback.

export function createGame(store) {
  const log = (s, type, params = {}) => s.log.push({at: s.clock, type, ...params});

  function deliver(s, trigger) {
    for (const message of MESSAGES) {
      if (s.inbox.some(m => m.id === message.id)) continue;
      const t = message.trigger;
      const fires = (t.accepted && t.accepted === trigger.accepted) || (t.completed && t.completed === trigger.completed);
      if (fires) s.inbox.push({id: message.id, at: s.clock, read: false, reply: null});
    }
  }

  const addItem = (s, id, qty) => {
    const entry = s.hold.find(e => e.id === id);
    if (entry) entry.qty += qty; else s.hold.push({id, qty});
  };
  const removeItem = (s, id, qty) => {
    const entry = s.hold.find(e => e.id === id);
    entry.qty -= qty;
    if (entry.qty <= 0) s.hold = s.hold.filter(e => e.id !== id);
  };

  return {
    accept(id) {
      const state = store.get();
      const contract = contractById(id);
      if (!contract || state.contracts[id] !== 'available' || assessContract(contract, state).status === 'blocked') return {ok: false};
      store.update(s => {
        if (s.active) { s.contracts[s.active] = 'available'; log(s, 'withdrawn', {contract: s.active}); }
        s.active = id;
        s.contracts[id] = 'active';
        s.accepted[id] = s.clock;
        s.focus = id;
        log(s, 'accepted', {contract: id});
        deliver(s, {accepted: id});
      });
      return {ok: true};
    },

    withdraw(id) {
      store.update(s => {
        if (s.active !== id) return;
        s.active = null;
        s.contracts[id] = 'available';
        log(s, 'withdrawn', {contract: id});
      });
      return {ok: true};
    },

    install(moduleId) {
      const state = store.get();
      if (!fitsReactor(moduleId, state) || state.installed === moduleId) return {ok: false};
      store.update(s => { s.installed = moduleId; log(s, 'installed', {module: moduleId}); });
      return {ok: true};
    },

    repair() {
      const state = store.get();
      const cost = repairCost(state);
      if (!cost || cost > state.credits) return {ok: false, cost};
      store.update(s => { s.credits -= cost; log(s, 'repaired', {from: s.hull, cost}); s.hull = 100; s.clock += 30; });
      return {ok: true, cost};
    },

    refuel() {
      const state = store.get();
      const cost = refuelCost(state);
      if (!cost || cost > state.credits) return {ok: false, cost};
      store.update(s => { s.credits -= cost; log(s, 'refuelled', {from: s.fuel, cost}); s.fuel = 100; s.clock += 15; });
      return {ok: true, cost};
    },

    upgradeReactor() {
      const state = store.get();
      const next = REACTORS.core96;
      if (state.reactor === next.id || state.credits < next.price) return {ok: false};
      store.update(s => { s.credits -= next.price; s.reactor = next.id; s.clock += 60; log(s, 'upgraded', {reactor: next.id, cost: next.price}); });
      return {ok: true};
    },

    launch() {
      const state = store.get();
      const contract = contractById(state.active);
      if (!contract || state.operation || assessContract(contract, state).status !== 'ready') return {ok: false};
      store.update(s => { s.operation = startOperation(contract, s); log(s, 'launched', {contract: contract.id}); });
      return {ok: true};
    },

    choose(optionId) {
      const state = store.get();
      const operation = state.operation;
      if (!operation) return {ok: false};
      const step = operationSteps(operation.contract)[operation.step];
      const option = step?.options.find(o => o.id === optionId);
      if (!option || !optionAvailability(option, operation, state).ok) return {ok: false};
      store.update(s => {
        s.operation = applyOption(s.operation, option);
        // The yard clock settles on return; steps are stamped with mission time.
        log(s, 'step', {contract: operation.contract, step: step.id, option: option.id, at: s.clock + s.operation.stats.minutes});
      });
      return {ok: true, done: store.get().operation.step >= operationSteps(operation.contract).length};
    },

    // Returns to the yard and settles the contract.
    finish() {
      const state = store.get();
      const operation = state.operation;
      if (!operation || operation.step < operationSteps(operation.contract).length) return {ok: false};
      const contract = contractById(operation.contract);
      const result = settle(contract, operation, state);
      store.update(s => {
        s.credits += result.payout;
        s.hull = result.hull;
        s.fuel = result.fuel;
        s.clock += result.minutes;
        for (const [id, qty] of result.stowed) addItem(s, id, qty);
        s.contracts[contract.id] = 'completed';
        s.active = null;
        s.operation = null;
        s.lastResult = result;
        s.results[contract.id] = result;
        s.reputation[contract.client] = (s.reputation[contract.client] ?? 0) + 1;
        // The first settled contract ends the first-job hints.
        s.flags.tutorialDone = true;
        const next = CONTRACTS.find(c => s.contracts[c.id] === 'available');
        if (next) s.focus = next.id;
        log(s, 'completed', {contract: contract.id, payout: result.payout});
        deliver(s, {completed: contract.id});
      });
      return {ok: true, result};
    },

    abort() {
      const state = store.get();
      const operation = state.operation;
      if (!operation) return {ok: false};
      store.update(s => {
        s.fuel = operation.stats.fuel;
        s.hull = operation.stats.hull;
        s.clock += operation.stats.minutes;
        s.contracts[operation.contract] = 'failed';
        s.active = null;
        s.operation = null;
        s.reputation[contractById(operation.contract).client] -= 1;
        log(s, 'aborted', {contract: operation.contract});
      });
      return {ok: true};
    },

    sell(id, qty = 1) {
      const state = store.get();
      const entry = state.hold.find(e => e.id === id);
      if (!entry || entry.qty < qty) return {ok: false};
      const value = itemValue(id, state) * qty;
      store.update(s => { removeItem(s, id, qty); s.credits += value; log(s, 'sold', {item: id, qty, value}); });
      return {ok: true, value};
    },

    strip(id) {
      const state = store.get();
      const item = ITEMS[id];
      const entry = state.hold.find(e => e.id === id);
      if (!entry || !item.strip) return {ok: false};
      store.update(s => {
        removeItem(s, id, 1);
        for (const [part, qty] of item.strip) addItem(s, part, qty);
        s.clock += 20;
        log(s, 'stripped', {item: id});
      });
      return {ok: true, parts: item.strip};
    },

    start() {
      store.update(s => { if (!s.started) { s.started = true; log(s, 'started'); } });
      return {ok: true};
    },

    // The goal: buy MULE-06 from the yard.
    buyout() {
      const state = store.get();
      if (state.shipOwned || state.credits < VESSEL.buyout) return {ok: false};
      store.update(s => { s.credits -= VESSEL.buyout; s.shipOwned = true; log(s, 'bought', {cost: VESSEL.buyout}); });
      return {ok: true};
    },

    endTutorial() {
      store.update(s => { s.flags.tutorialDone = true; });
    },

    read(id) {
      store.update(s => { const m = s.inbox.find(x => x.id === id); if (m) m.read = true; });
    },

    reply(id, choiceId) {
      const state = store.get();
      const entry = state.inbox.find(m => m.id === id);
      const choice = messageById(id)?.choices?.find(c => c.id === choiceId);
      if (!entry || entry.reply || !choice) return {ok: false};
      const e = choice.effects;
      store.update(s => {
        const m = s.inbox.find(x => x.id === id);
        m.reply = choiceId;
        m.read = true;
        if (e.credits) s.credits += e.credits;
        if (e.fuel) s.fuel = Math.min(100, s.fuel + e.fuel);
        for (const [who, delta] of Object.entries(e.reputation ?? {})) s.reputation[who] = (s.reputation[who] ?? 0) + delta;
        if (e.flag) s.flags[e.flag] = true;
        if (e.reveal && s.contracts[e.reveal] === 'hidden') s.contracts[e.reveal] = 'available';
        if (s.flags.haldenClosed && s.contracts.seraph === 'available') s.contracts.seraph = 'hidden';
        log(s, 'replied', {message: id, choice: choiceId});
      });
      return {ok: true, effects: e};
    },

    canStow: (id) => holdFree(store.get()) >= ITEMS[id].mass,
    serviceNeeds: () => {
      const state = store.get();
      return {repair: repairCost(state), refuel: refuelCost(state), minHull: SERVICE.minHullToLaunch};
    },
  };
}
