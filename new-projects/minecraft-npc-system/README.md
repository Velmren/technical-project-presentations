# Minecraft NPC System

Bukkit/Spigot plugin with configurable NPCs, branching dialogues, staged quests and shops, plus a reproducible harbour world, Tidehaven, with eight residents. Plugin version 1.0.0.

The same JAR was run on Paper 1.21.11 build 132 (main test server), Spigot 1.21.11, Purpur 1.21.11 build 2568, Purpur 1.16.5 build 1171 and Paper 26.3 build 49 (alpha). Each run passed 112 runtime assertions and 684 dialogue graph assertions. The plugin declares Bukkit API 1.16 and compiles against Spigot API 1.16.5; Minecraft versions between the tested ones have not been checked. See [COMPATIBILITY.md](COMPATIBILITY.md).

## Installation

1. Stop the server and back up its files.
2. Put `minecraft-npc-system-1.0.0.jar` in `plugins/`.
3. Start the server with the Java version its build requires. The plugin is compiled with `--release 16`, so it needs Java 16 or newer even on 1.16.5. The tested Paper and Purpur 1.21.11 and Paper 26.3 servers ran on Java 25, Spigot 1.21.11 on Java 21, Purpur 1.16.5 on Java 16.
4. Check the startup log and run `/npcs integrations` as an operator.
5. Run `/npcs demo install` to build the demo. It creates a separate world, `npc_demo`, and teleports the operator to its spawn.

Native NPCs need no other plugins. Definitions with `world: npc_demo` wait until that world is loaded.

`/npcs demo install confirm` rebuilds the harbour area and resets the blocks of its repair objectives. It does not reset player progress, so use a new test player or matching world and data backups for a fresh run. Do not build inside the demo area before reinstalling.

## Commands

An NPC opens its dialogue on a main-hand interaction. Options are shown in an inventory menu and as clickable chat commands. Shops use the Minecraft inventory.

| Command | Description |
| --- | --- |
| `/npcs help` | List commands |
| `/npcs quests` | Player progress |
| `/npcs accept <quest>` | Accept a quest after checking its conditions |
| `/npcs claim <quest>` | Claim the reward for completed stages |
| `/npcs list` | NPC definitions and spawn state |
| `/npcs integrations` | Adapter and economy provider status |
| `/npcs reload` | Validate all YAML files and apply them |
| `/npcs create <id>` | Create an NPC at the operator's position |
| `/npcs set <id> <field> <value>` | Change a supported NPC field |
| `/npcs remove <id>` | Remove a definition; refused while quests reference it |
| `/npcs spawn <id>`, `/npcs despawn <id>` | Store whether the NPC is enabled |
| `/npcs teleport <id>` | Teleport the operator to an NPC |

`npcs.use` is granted to players by default, `npcs.admin` to operators. `/npcs choose <token> <index>` is issued by the dialogue UI; the token is bound to the player, the session, the distance and a time limit.

## Configuration

Files in `plugins/MinecraftNPCSystem/`:

| File | Contents |
| --- | --- |
| `config.yml` | Currency (`emerald` or `vault`), interaction distance, session length |
| `npcs.yml` | IDs, names, entity types, professions, positions, routes and links |
| `dialogs.yml` | Nodes, options, conditions, transitions and actions |
| `quests.yml` | Dependencies, repeat limits, stages and rewards |
| `shops.yml` | Items, amounts, buy and sell prices, permissions |
| `progress.yml` | Player state by UUID, saved by the plugin |

Edit the YAML and run `/npcs reload`. All files are validated together before the active configuration is replaced; a syntax, reference or value error keeps the previous snapshot. The full reference with examples, conditions and the API is in [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

Quest objectives: TALK, COLLECT, DELIVER, VISIT, BREAK, KILL and EVENT. Only the current stage records progress. COLLECT checks the inventory, DELIVER takes the items. BREAK on WHEAT counts broken wheat blocks without checking growth. Other conditions can be reported by another plugin through EVENT.

Native routes are straight segments at a fixed height with a check for free foot and head space. They do not avoid obstacles, follow terrain or cross worlds; use Citizens for pathfinding. NPCs keep their IDs in the persistent data container and are restored after unloading.

## Economy and integrations

- Emeralds are ordinary items in storage slots. Armour, the off hand and items with custom metadata do not count. Amounts are whole numbers, capped at 2304 for native prices and rewards.
- Vault needs Vault and a registered Economy provider. The currency is chosen explicitly; a missing provider does not fall back to emeralds.
- PlaceholderAPI: text placeholders and the `npcs` expansion, including `%npcs_stage_<quest>%`, `%npcs_active_<quest>%`, `%npcs_completed_<quest>%` and `%npcs_variable_<key>%`. Stage numbers start at zero.
- WorldGuard 7 / WorldEdit 7: interactions are checked against the INTERACT flag, with bypass support. A failed query denies the interaction.
- Citizens: a separate `citizens` backend using the registry, SkinTrait and Navigator. A missing or incompatible adapter does not disable native NPCs.

Names, quests and dialogue for the demo are in Russian in the YAML files. System messages, errors and parts of the shop UI are in English.

## Saving and transaction limits

Progress is written to a temporary file, flushed and renamed atomically where the file system supports it. A failed write rejects the operation and restores the previous snapshot. A corrupted state file stops the plugin from starting instead of silently resetting players.

A reward first stores a pending-delivery marker, so repeated claims and clicks do not pay twice. The Minecraft inventory, an external economy and YAML do not share one transaction, though: a crash between writes can leave a reward delivered or not delivered with the marker set, and automatic retry is blocked. After checking the inventory, balance and blocks, an operator runs `/npcs recover <uuid> <quest> completed` to confirm the delivery or `unlock` to allow a new attempt. Shop trades have no crash journal.

Back up `progress.yml` together with player data and the world.

## Building from source

Requires JDK 16 or newer, PowerShell 7 and network access for the first dependency download:

```powershell
./scripts/build.ps1
```

Output: `build/minecraft-npc-system-1.0.0.jar`. The script pins the Spigot API 1.16.5 snapshot and PlaceholderAPI 2.11.7, runs the core checks and does not bundle API libraries into the plugin. `mvn package` also builds the JAR; the core checks run only through the PowerShell script. Details: [docs/CORE-BUILD.md](docs/CORE-BUILD.md).

The landing page runs with `node scripts/serve.mjs` on http://127.0.0.1:4193. Its dialogue is a browser demo and is not connected to a server.

## Further reading

- [SCENARIOS.md](SCENARIOS.md): walkthroughs of the harbour quests and their test results.
- [COMPATIBILITY.md](COMPATIBILITY.md): tested servers and the extended adapter run.
- [docs/DEMO-WORLD.md](docs/DEMO-WORLD.md): how the harbour world is built.

`web/assets/game/harbor-overview.png` and `harbor-ships.png` are screenshots from the vanilla client on Paper 1.21.11, without shaders.

This is an independent project and not an official Mojang or Microsoft product.
