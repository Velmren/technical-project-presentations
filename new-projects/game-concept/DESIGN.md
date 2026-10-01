# LACUNA: design

## Premise

MULE–06 is a small salvage tug based at Kepler Yard, on the ring of a station that broke apart in high orbit around the gas giant Morrow. The gap where the station failed is the Lacuna; wrecks drift there, and contracts to recover or strip them are the player's work. The vessel is the player's body in the world: its fit decides which jobs are possible, and every choice changes the object on screen.

## Goal and entry

The player has one clear aim: **buy MULE–06 from the yard for 50 000 cr** (starting with 6 200). There is no deadline and no losing state; this is a showcase, not a pressure game. A new game opens on a title screen over the drydock that says who the player is, what the goal is and how the work goes, with one way in ("Start the shift"), the language and a single sound question. It also covers the 3D scene while it loads.

From then on two things are always on screen: the buyout meter in the top bar (the balance is its numerator) and a "Now" line under it with the next step toward the goal, derived from the state (choose a contract, fit a module, launch, reply to a client). The first contract adds one hint at a time beside the control it explains; the hints stop after the first settled job or when dismissed.

## The loop and its screens

| Step | Screen |
| --- | --- |
| Who, why, how; one way in | Title screen |
| Choose a job: target, requirements, risks, reward | Sector map (the map is the list) |
| Prepare the vessel: fit, repair, refuel, upgrade the reactor | Drydock |
| Swap equipment with a preview and a cancellable commit | Hardpoint bench |
| Fly a short recovery with decisions and visible costs | Operation |
| Payment, bonus, wear, what went into the hold | Results |
| Answer the client, with consequences | Comms |
| Sell or strip items that differ in look and purpose | Cargo hold |
| Objectives, progress, history | Log (briefings and events) |
| Language, sound, controls, display, reduced motion, new game | Settings |

One state feeds every screen (`src/state.js`). Game actions (`src/game.js`) validate against shared pure rules (`src/rules.js`), change the state in one step, write a log entry and deliver any client message they trigger. The screens are functions of that state, so the map, drydock, bench, operation and hold always agree: installing LATCH G–2 changes the model on the hardpoint, the dry mass, the power bar, the contract checklist, the route fuel on the map and which operation options are open.

## How decisions carry consequences

- **The fit decides what is possible.** Each contract states a capability (tow rating, cutting depth). In the operation, some options need more than the minimum: stopping NACRE–9's spin with the winch needs 100 m of cable, which only LATCH G–2 has. A locked option stays visible with the reason.
- **Costs are shown before choosing.** Every option lists its minutes, fuel, hull wear, cargo integrity, reward factor and the items it will put in the hold. Telemetry updates after each step.
- **Settlement follows the choices.** Integrity at 80% or above earns the intact bonus; BRINE HOLLOW's hull wear grows with time spent inside the radiation window; TALLOW REACH pays by the tonne cut. Items that do not fit into the hold are left behind and reported.
- **Wear persists.** Hull and fuel carry over to the next job. A contract checks fuel for the round trip and a minimum hull, and the drydock offers paid repair and refuelling.
- **Clients remember.** Replies change credits, fuel, standing and flags: telling Halden Mutual about the missing lifeboat opens SERAPH–2; selling them a copy of the recording pays more and closes that lead; an exclusive deal with the Orrin co-op raises plating prices.
- **Abort is a real choice.** It keeps the wear taken so far and fails the contract, with a confirmation first.

## Interface rules

- **One main action per screen, one large thing.** Sector: the map with its markers and the chosen contract's card with "Accept". Drydock: the vessel and its readiness for the active contract. Operation: the scene, the two options and "Execute". Everything else is smaller or behind "Details".
- **Every label informs a decision.** No decorative telemetry, section numbering or ghost numerals. What remains is what the player uses: balance, requirements and whether they are met, power reserve, mass, hold space, route, fuel, hull, deadline, risks, costs and consequences.
- **Hierarchy by size, weight and colour, not micro-captions.** The display face carries names, titles and values; the text face carries descriptions. Labels are sentence case at 13 px or larger. Numbers use tabular figures with their units set smaller.
- **One accent, states by meaning.** Graphite neutrals carry the interface. Amber appears only on the main action, the current selection and the current goal (the "Now" line, the buyout meter, the route on the map). Green means a requirement is met or something is gained; red means blocked, lost or dangerous. Warnings that are only "work to do" (a refit, refuelling) stay neutral with an icon. Costs are neutral numbers with icons; they turn red only when they cross a threshold that matters (losing the intact bonus, a hull below half). Toggles such as language and sound use a neutral pressed state, not the accent.
- **One primary action per view.** The drydock's primary action follows the contract (open the map, fit the module, repair, refuel, launch). Blocked actions stay visible, disabled, with the reason next to them.
- **Text over the 3D view has a backing.** Titles and service text over machinery sit on a soft gradient; panels are translucent graphite with a hairline border.
- **States.** Hover, focus, pressed, selected, disabled with explanation, empty (no contract, empty hold, no events), confirmation (switch or withdraw a contract, reactor upgrade, abort, new game), progress (coupling, executing a step), success and cancellation toasts, reward (count-up on results, balance flash), WebGL loss.

## Visual system

- Graphite surfaces, warm painted machinery, amber for action. The bay's floor markings are muted so they do not compete with the accent.
- Type: **Tektur** (condensed, 600 and 700) for names, titles, buttons and values: squared, technical and legible in Cyrillic without looking like a system font. **Lacuna Text** (IBM Plex Sans, renamed for the licence) for text and labels. Both cover Russian and English, so the two languages look the same. Tektur was chosen after comparing it on the map and the bench with Sofia Sans Condensed, Geologica and IBM Plex Sans Condensed as display faces.
- Icons are one stroke set. Modules in the systems panel and the bench tray are pictures of the 3D models themselves, rendered in the browser in a side view (tool left, coupling right, as on the stand); the line drawings remain only as a stand-in when there is no 3D view.

## Sector

On a wide screen the orbital map is the contract list: every marker shows the name and the pay without hovering, with the status as an icon and a word; markers are buttons after the top bar in the Tab order. The chosen marker is highlighted and tied to its card by a thin leader line. The card is short: kind and client, name, pay with any bonus, a two-line brief, one readiness line (what is missing and where to fix it, or "ready"), one line of facts (distance, travel time, fuel share, deadline, risk) and "Details" for the full checklist and risks. On a phone the list stays under the map band and each contract opens as a sheet.

## Operation

Laid out like a game HUD rather than a form. The target has its own frame at the top centre (name, kind and client, cargo integrity or the radiation window, a status line such as "Tumbling at 6° a second", and the step progress as segments). MULE–06 has its frame at the bottom left (module, hull, fuel, mission time, abort). The decision sits at the bottom centre: step and lead, two option cards, Execute. Choosing an option previews its cost before anything is committed: the part of a bar it would cost turns pale and striped, the old value is shown struck through, and the flight path or cable run is drawn dashed in the scene. Options that exist because of the fitted module say so ("Possible with LATCH G–2: 140 m"). Targeting brackets sit on the wreck in the scene; the client comments over the radio after each step; a hit to the hull shakes the shot briefly (not with reduced motion).

Launching plays a short shot in the bay (the vessel lifts off the cradle, turns to the door and leaves, about 1.5 s); docking plays it in reverse before the results. A click or any key skips either; with reduced motion they do not play.

## 3D

Everything is authored in code; there is no DCC file, no bitmap art and no texture set.

- **Modelling kit** (`src/render/kit.js`): rounded trapezoid lofts for hulls, lathes with filleted profiles, filleted extrusions with rolled bevels, rods between points, tubes for hoses. Normals are creased (smooth across bevels, hard across true corners). Parts are merged per material.
- **Materials** (`src/render/materials.js`): paint is dielectric; bare metal appears only where paint has worn. A triplanar layer in object space varies paint tone, breaks up roughness, adds scratches and grime runs, draws panel seams as bump, and chips paint where the geometry's curvature marks an edge. Stencils and soot are canvas decals.
- **Models:** MULE–06 with a detail pass (service panels, vents, handrails, stencils, soot, replaced plates, console glow on the glazing); LATCH G–2, KESTREL C–8 and HELIOS A–9; five operation targets; seven salvage items for the hold.
- **Bay:** docking cradle, umbilical boom whose drop lines retract when the vessel lifts off, an inspection table that turns and tilts on a ball joint with the module resting on its pads, a storage lift (doors that swing down into the shaft, ribbed walls, a lit landing and a carriage), columns, girders, catwalk, wall ribs and pipes, light bars, crane, cargo, floor markings with stains, light shafts under the far fixtures, and a bay door onto the planet.
- **Light:** key spot from high front-left with soft shadows, cool rim, low fill, an emissive light probe for reflections, GTAO and restrained bloom on the high tier. The bench view brings up its own spot and dims the key.
- **Object continuity:** modules travel between the hardpoint, the inspection table and the storage lift. A preview rides the carriage up the shaft, turned lengthwise to fit it, then swings onto the table; the installed module stays mounted until the commit. Reduced motion places everything immediately.
- **Assembly rules:** every mesh is closed; every cable ends in a gland on the surface it enters and passes through nothing; nothing floats. `node tools/audit-geometry.mjs` checks this on the vessel, the modules, the bench and the bay fixtures, and that each module rests on both table pads.
- **Sector map:** a shaded gas giant with atmosphere, a dust ring that thins out at the Lacuna, instanced debris, marker stems and an animated route. The camera fits every visible marker into the space between the panels.
- **Operation:** the vessel works its target above Morrow, with a sky that lifts toward the planet and the Lacuna ring as a dusty band behind the work, so the space reads as a place rather than a black void. The NACRE–9 courier is broken behind its cargo bay: livery band, glazing, the orange recorder on its spine, a torn end with peeled skin, broken frames, stringers and cables. The debris field is bevelled hull fragments and struts in hull paint and primer, kept off the line between camera and work. Each option plays a short, interruptible sequence (approach path, cable brake, cutting sparks, cargo coming aboard, departure). The vessel flies these moves as a craft with mass: it burns to speed, coasts and brakes; the nose swings into the direction of travel and back to the working heading before arrival, the hull pitches with a climb and banks into turns, each with some lag. The main engines show a plume that grows under acceleration and shrinks when coasting, and reaction-control jets puff at the nose when braking and on the side that swings the hull, in pale, restrained colours; the camera refits the vessel and target into the band between the target frame and the decision every frame, then follows the vessel home. All five targets are built while the browser is idle after start-up.
- **Scene changes never pass through black.** Changing world (map, bay, operation) covers the canvas with a copy of the last frame, draws the new world at once and dissolves the copy. Document screens (results, hold, log, comms, settings) pause the 3D view and sit on their own background instead of a dimmed render. A resize or a quality change redraws in the same frame. A lost WebGL context (a driver reset) shows a notice and the scene is rebuilt when the context comes back; only if it does not come back within eight seconds does the recovery panel appear.
- **Performance:** rendering happens only while something changes; shadow maps update only when objects move; quality tiers (high: GTAO, bloom, MSAA, 2048 shadows; medium: no GTAO; low: direct rendering) with automatic step-down when frames run slow; phones start on low. All three worlds are drawn once off screen after start-up so switching never stalls on shader compilation. Hold thumbnails and module pictures are rendered once from the models when the browser is idle.

## Sound

Off by default and never autoplayed. When switched on, interface cues (select, confirm, deny, coupling, move, reward, message) and a low ambience bed are synthesised with Web Audio; volume, interface sounds and ambience are separate settings.

## Phone

The phone has its own scenario rather than a shrunken desktop. The title screen stacks over the drydock. The 3D view becomes a band at the top of the sector, drydock, bench and operation, with the "Now" line over it; sections move to a bottom tab bar, and language moves to settings and the title screen to leave the top bar to the buyout meter. A contract, a hold item, a log entry and a message each open as a full-screen sheet with a back button. In an operation the target and vessel frames stack under the band, the options follow and Execute is pinned to the bottom of the screen. Results, hold, log, comms and settings read as documents without 3D.

## References

Game interfaces studied for clarity and game feel (nothing copied):

- MMO player and target frames (a survey of 22 games, among them FFXIV, ESO, WoW, Guild Wars 2, New World, Lost Ark): two frames of one construction, the player's richer, the target simpler, a boss target given its own place at the top; thin bars with the key number large.
- Hardspace: Shipbreaker: a clear goal from the first minute (debt for the ship), colour as a code used the same way everywhere, information inside the world.
- FTL: the ship is the interface, hull always visible, the enemy in its own frame, event options unlocked by equipment.
- Into the Breach: consequences shown before the move, objectives always on screen, clarity preferred over effects.
- Elite Dangerous: a nearly single-colour cockpit HUD at the edges, the centre left to the world.

Visual direction set after inspecting professional work on ArtStation:

1. [Vladimir Jankovic, Major Retrograde](https://dreamaze.artstation.com/projects/Ev8NrA): a large object, a strong title and compact information in one composition.
2. [Paolo Parrucci, The Division 2](https://mrninja13.artstation.com/projects/dOVdkK): the subject stays grounded in its world while information sits on a separate readable layer; one decisive accent.
3. [Robin Fuentes, Bountyhunter Station](https://robin_fuentes.artstation.com/projects/y49gA8): purposeful seams, mixed materials, cables and local wear make hardware credible.
4. [Taylor Buck, Inventory + Gear](https://taylor_buck.artstation.com/projects/Pmk8wB): aligned comparison and slot density.

No reference artwork is used in the product.

## Known limits

- Procedural models reach a clean, stylised hard-surface level. They do not match sculpted, baked and hand-textured production assets in micro-detail: there are no normal-mapped bolts, weld beads or fabric, and wear is procedural rather than painted.
- The operation is a sequence of authored decisions played as short animations, not free flight.
- The title screen, the goal line, the sector and the operation follow the current layout rules; the drydock, bench, results and document screens still use the earlier layout.
- Frame timing was measured on one desktop GPU; the automatic quality step-down is the safeguard for weaker laptops.
