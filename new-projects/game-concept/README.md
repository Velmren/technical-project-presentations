# LACUNA

Interface for an orbital salvage game. The player runs MULE–06, a small salvage tug working the broken station ring around the gas giant Morrow, and aims to buy the vessel from the yard for 50 000 cr: take a contract on the sector map, fit the vessel for it in drydock, fly a short recovery operation made of decisions, settle the job, then trade the salvage and answer the client. One game state runs through every screen and survives reloads.

## Run

Requires Node.js 18 or newer. There is no build step and no dependency to install for running the app.

```bash
node serve.mjs
```

Open http://127.0.0.1:4353/. The server binds to the local machine only; set `PORT` to use another port.

## One full run

0. **Title screen.** Who you are, the goal and how the work goes, with "Start the shift", the language and a sound choice. After that the buyout meter sits in the top bar and a "Now" line under it names the next step; the first contract adds one hint at a time.
1. **Sector.** On a desktop the ring map is the contract list: each marker shows name and pay; the chosen one is tied to its card. Each is checked against the vessel as it is fitted now: ready, refit needed, service needed, or beyond this vessel (BRINE HOLLOW needs 92 kW; MULE–06 starts with 82 kW). Accept NACRE–9; its client sends a briefing to **Comms**. Accepting another contract while one is active asks first.
2. **Drydock.** The active contract says what is missing ("Install LATCH G–2") with a direct action. The rail shows hull, fuel, power allocation, a reactor upgrade (24 000 cr, confirmed before paying) and paid repair and refuelling.
3. **Bench.** The previewed module rises from the storage lift onto the turntable; the installed one stays on the ship until you commit. Compare what it does for the contract and to the vessel. Install starts a one-second coupling that Escape cancels. HELIOS A–9 can be inspected but not installed on the stock reactor.
4. **Operation.** Launch from the drydock (a short departure shot, skippable). The target has a frame at the top, MULE–06 at the bottom left. Each step offers two options with their costs shown before you choose: minutes, fuel, hull wear, cargo integrity, what goes into the hold. Choosing one previews the loss on the bars and the path in the scene. Some options need the right tool (a 100 m cable) or enough fuel and say so. Execute plays the move; the client comments over the radio. Abort is possible until the last step and fails the contract.
5. **Results.** After the docking shot: payment with the intact-cargo bonus if integrity stayed at 80% or above, hull and fuel before and after, salvage stowed or left behind for lack of space.
6. **Comms.** The client writes after the job. Replies have visible effects: credits, standing, fuel, and one of them opens a new contract (SERAPH–2) on the map.
7. **Hold.** Items differ in mass, value and purpose. Sell one or all, or strip an item into parts that sell better; hazardous cargo cannot be stripped. Agreeing to sell plating only to the Orrin co-op (a reply after TALLOW REACH) raises its price by 15%.
8. **Log.** Contract briefings with live objective progress, and the history of every action.
9. **Settings.** Language, optional sound (off by default, synthesised in the browser), camera sensitivity and inverted vertical look, 3D quality, reduced motion, inspection light, and a new game that keeps preferences.

RU and EN switch instantly without losing the screen or any state. On a phone the same run works with a bottom tab bar, list-to-detail sheets and a pinned action bar for decisions.

Keyboard: any key or click skips a launch or docking shot. `M` sector, `V` vessel, `H` hold, `L` log, `C` comms, `B` bench (from drydock), `1`–`3` modules on the bench, options in an operation or replies in comms, `Enter` executes the chosen option, `Esc` cancels coupling or goes back, `R` resets the view, arrow keys look around when the 3D view has focus.

## Source

| Path | Role |
| --- | --- |
| `src/main.js` | Routing, rendering from state, actions, keyboard, dialogs, bridge to the 3D stage |
| `src/state.js`, `src/game.js`, `src/rules.js` | Persistent state; game actions with their log entries; pure rules for power, mass, fuel, hold space, readiness and settlement |
| `src/data/` | Vessel and modules, contracts, operation steps and options, salvage items, client messages |
| `src/i18n.js`, `src/locales/` | Dictionaries, interpolation, locale number and clock formatting |
| `src/screens/` | One module per screen, each a function of state |
| `src/render/` | WebGL stage, modelling kit, materials, vessel, modules, bay, sector map, operation scene, item models |
| `src/audio.js` | Optional synthesised sound |
| `styles/` | Tokens and type roles, shell, screen and page layouts, responsive rules |
| `tools/` | Verification, recording, build to the portfolio, vendoring Three.js, syntax check |

Development scripts (`npm run verify`, `npm run record`) need Playwright: `npm i -D playwright`, or point `PLAYWRIGHT_CORE` at an existing `playwright-core` folder. `node tools/verify.mjs --software` runs the same checks on software WebGL without touching the graphics card (frame timings are then skipped). `node tools/record.mjs --dry-run` walks the recording sequence without recording. `node tools/check-paths.mjs` plays every operation path of every contract through the rules, without a browser. `node tools/audit-geometry.mjs` (`npm run audit`) checks the models without the graphics card: closed meshes, no cable passing through a part, no floating parts, every module resting on both table pads. `npm run build` copies the runtime and `thumbnail.webp` into `../../public/projects/game-concept/`. `npm run vendor` refreshes `vendor/three` from a `three` 0.180 package in the portfolio's `node_modules`.

All models, materials, the environment, the sector map and the operation scenes are built in code at start-up; see [ASSETS.md](ASSETS.md) for fonts and licences and [DESIGN.md](DESIGN.md) for the design.
