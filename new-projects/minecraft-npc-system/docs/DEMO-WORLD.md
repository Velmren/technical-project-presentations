# Tidehaven demo world

Tidehaven is a deterministic Bukkit block blueprint, not a generated image or a WorldEdit dependency. It builds a playable harbor village with two sailing ships, five furnished buildings, a forge, market stalls, a mature wheat field, logging yard, water mill, lighthouse, woods, town gate and a distant castle silhouette. Village ground is y=64; NPC feet are y=65. Water ends at y=63.

## Install and reproduce

1. Build/install the project JAR using the project README. Start a separate development Minecraft server and join as an administrator.
2. Run `/npcs demo install` for initial installation. A repeated installation requires `/npcs demo install confirm`, because it overwrites the dedicated demo volume. It creates/loads `npc_demo`, calls `DemoWorld.build(world)` on the main thread, then installs the NPC definitions. The blueprint itself never creates a world or chooses a generator.
3. Teleport to the spawn at **0.5, 65, 7.5** in `npc_demo`. Verify the eight NPCs are present after the core plugin reconciliation. Use a normal Minecraft client for actual visuals.
4. To reproduce the blocks, run `/npcs demo install confirm` only in the dedicated demo world. This replaces the demo volume and resets the two broken repair targets. Export an installed world using a stopped-server copy of the entire `npc_demo` directory, including region files and level.dat. Preserve the YAML configs separately.

`DemoWorld.build(World)` refuses any world whose name is not exactly `npc_demo` and refuses an asynchronous call. It returns the spawn `Location`. `DemoWorld.landmarks(World)` returns an unmodifiable map of NPC feet, repair blocks and useful landmarks. No other world's blocks are modified.

A synchronous build writes roughly 1.3 million block positions. Expect a visible server pause during this explicit install; it is not performed on ordinary startup or player join. The operation is bounded to x **-88..88**, z **-78..82**, y **59..106**, clearing y65..106 and replacing the lower terrain. Use an empty or flat dedicated world: terrain outside the stated volume and below y59 is intentionally outside the blueprint.

## Places and routes

The cobbled square sits at the origin. A north/south gravel avenue leads through the twin watchtowers to the gate, and south to the quay and long wooden pier. West/east avenues cross z=-11 and z=9. The lumberjack is beside the logging cottage and stacked logs, the smith beside the working forge, the cartographer outside the chart house, the farmer at the field gate, the merchant on the market approach and the keeper inside the open lighthouse entrance. The elder stands in the middle of the square; the guard stands on the northern avenue. NPC routes should use these avenues or their existing role coordinates, with feet y65.

| NPC ID | Feet x, y, z |
|---|---|
| elder | 0, 65, 0 |
| lumberjack | -22, 65, -12 |
| smith | 20, 65, -10 |
| merchant | 12, 65, 12 |
| keeper | 42, 65, 10 |
| farmer | -20, 65, 18 |
| guard | 0, 65, -26 |
| cartographer | -12, 65, 8 |

The lighthouse has internal scaffolding at **42, *, 8** to its observation chamber. A conspicuous absent lamp at **42,79,10** is the lighthouse repair slot; restore `SEA_LANTERN`. The mill's missing lower spoke at **-35,66,-10** accepts `OAK_PLANKS`. The surrounding structure is built before those two exact slots are reset to `AIR`, keeping repairs visually deterministic.

## Capture suggestions

Set a clear daytime sky, use spectator or creative flight, and capture from an actual rendered client. The harbor overview at **-45,89,56**, looking toward **3,67,0**, places sails and the dock in the foreground with the village and castle behind. A street capture from **5,69,22** toward **0,67,-8** frames the square, watchtowers and NPCs. Lighthouse detail: **54,72,25** toward **42,73,10**. Mill detail: **-27,70,-3** toward **-39,69,-12**. A render distance of 12 chunks covers the exhibit. These are composition coordinates, not evidence that captures were taken.

## Source and compatibility

- [Blueprint manifest](../demo/blueprint.json): machine-readable bounds, characters, structures, repairs and capture points.
- `src/main/java/dev/velmren/npc/DemoWorld.java`: authoritative, reproducible source blueprint. No binary schematic parser is needed.
- Bukkit-only material names and APIs are chosen from the 1.16 era; no NMS or Paper-only imports. This is design intent, not an untested compatibility claim.
- Verified compilation: `javac --release 17` against the installed Paper 1.21.11 library classpath, completed successfully. Building the world on a running server and checking it in a client are separate steps.

The `.class` file produced during a local compile check is a temporary artifact, not part of the distributed blueprint. The project JAR contains the executable blueprint; the source/config archive should include this manifest and source.


### Offline geometry verification

Run `pwsh -File demo/verify-geometry.ps1 -LibraryRoot <server-library-directory>` from the project root. This compiles the blueprint with Java release 17 and executes its actual block placement methods against recording Bukkit interface proxies. The test verifies all eight NPC positions and optional avenue route segments have non-water ground and clear feet/head space; both repair slots are AIR; the lighthouse scaffolding opens into a chamber with standing/head room. It passed with **172,162** recorded non-air cells. It does not simulate block physics, validate material rendering, run NPC logic or replace server/client validation. Compiled probe artifacts go to a temporary directory by default.

`demo/routes.yml` contains optional tested avenue loops.

