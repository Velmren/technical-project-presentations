# Configuration and extension reference

## Files and reload

`plugins/MinecraftNPCSystem/config.yml` holds globals. `npcs.yml`, `dialogs.yml`, `quests.yml`, and `shops.yml` each contain their corresponding root section. The shipped eight-character harbor is an editable example, not a hardcoded quest. `/npcs reload` parses **all** files and validates their references before changing the active snapshot. Invalid files retain the previous snapshot and entities. NPC admin edits validate the combined snapshot and atomically replace `npcs.yml`. Back up files before editing.

```yaml
# config.yml
economy: emerald             # emerald or vault; no silent fallback
interaction-distance: 6
session-seconds: 90
```

Emerald currency uses ordinary emeralds in storage slots, excluding armor/offhand and custom metadata. Vault requires Vault **and an installed economy provider**. Currency quantities must be whole emeralds; native prices and rewards are limited to 2304. Vault accepts nonnegative finite decimal amounts.

## NPC authoring

```yaml
npcs:
  guide:
    name: '&6Проводник'
    role: Помощь новичкам             # descriptive author metadata
    enabled: true
    backend: native                  # native or citizens
    type: VILLAGER                    # Bukkit EntityType
    world: world
    x: 10.5
    y: 65
    z: 20.5
    yaw: 180
    pitch: 0
    profession: LIBRARIAN
    villager-type: PLAINS
    dialogue: welcome
    shop: market
    permission: harbor.guide
    look-radius: 8                   # 0..128
    interval: 10                     # ticks between look/route updates
    speed: 0.15                      # blocks/update, native 0 < speed <= 1
    route:
      - {x: 10.5, y: 65, z: 20.5}
      - {x: 15.5, y: 65, z: 20.5}
```

Location coordinates are feet positions. A missing/unloaded world defers spawning until world load; the plugin does not invent the world. Native entities are protected, have disabled AI and are identified by a persistent data key. Reconciliation runs every five seconds and on chunk/world load, removes stale tagged duplicates, and recreates missing entities. Definitions may select any spawnable living Bukkit type available on that runtime. `PLAYER` requires Citizens. Native villager appearance uses Bukkit professions/types. Other entities ignore villager appearance.

Native routes are straight segments through passable feet/head blocks at the supplied height. They do not pathfind around obstacles, follow terrain, cross worlds or break blocks. Use level, unobstructed waypoints, or Citizens navigation for pathfinding. Citizens definitions may include `skin: PlayerName`; its actual SkinTrait and Navigator APIs are called. Missing/incompatible Citizens refuses that NPC backend, logs the error, and keeps native NPCs available. NPC data is tagged in Citizens' persistent metadata so owned NPCs can be cleaned up after restart. Unowned Citizens NPCs are not touched.

## Branching dialogue

```yaml
dialogs:
  welcome:
    start: start
    nodes:
      start:
        text: 'Привет, {player}. Твоя репутация: {var:reputation}.'
        choices:
          - text: Взяться за работу
            conditions:
              - {type: completed, quest: welcome, not: true}
              - {type: active, quest: welcome, not: true}
            actions: [{type: quest, quest: welcome}]
            next: details
          - {text: Открыть рынок, open-shop: true}
      details:
        text: 'Поговори с кузнецом и возвращайся.'
        choices: [{text: До встречи}]
```

An absent `next` closes the graph after actions. `open-shop: true` opens the current NPC's linked shop. Conditions are all required; `not: true` negates a condition. Unknown condition/action types, missing IDs, invalid items, invalid coordinate types, dependency cycles and missing graph links reject reload. Actions execute in order and stop after failure. An author should put a quest acceptance/claim before any optional follow-up effects so failed acceptance cannot award unrelated effects.

| Condition | Fields |
|---|---|
| `permission` | `permission` Bukkit permission node |
| `variable` | `key`, `value` (compared as strings) |
| `completed` | `quest` — at least one rewarded completion |
| `active` | `quest` — accepted and not yet rewarded |
| `item` | `material`, `amount` default 1; ordinary storage items |

| Action | Fields |
|---|---|
| `quest` | `quest` — accepts with dependency, cooldown and permission checks |
| `complete` | `quest` — claims only after every stage |
| `variable` | `key`, `value` — persisted per UUID |
| `message` | `text` |
| `item` | `material`, `amount` — complete capacity preflight |
| `money` | `amount` — configured currency |
| `block` | `world`, `x`, `y`, `z`, `material` |
| `event` | `event` — advances an active matching EVENT stage |
| `command` | `command` — trusted console command; `{player}` and `{uuid}` only |

Variable keys and configuration IDs allow letters, numbers, `_` and `-`. Graph text/choice labels resolve `{player}`, `{var:key}`, `{quest:id:stage}`, `{quest:id:completed}`, Minecraft `&` colors, and installed PlaceholderAPI placeholders. Stages displayed by placeholders are zero-based internal counts; a completed two-stage quest has `stage=2`.

Inventory menus and chat command choices share a random 96-bit token scoped to one player's current session. Each choice consumes that token before effects; distance, world, NPC permission, use permission, WorldGuard and conditions are rechecked. A token from another player, old graph, reload, expired session or already-selected menu cannot be replayed. Chat emits `/npcs choose <token> <zero-based index>`. Native Bukkit text avoids requiring a chat formatting plugin. Russian sample dialogue/quest names ship by default; control, error and shop messages are currently English.

Direct repeatable `item`, `money` and `block` actions are deliberately author controlled. Use quest rewards for one-time or limited rewards. The plugin cannot infer whether a free repeatable dialogue reward was intentional.

## Ordered quests

```yaml
quests:
  repair:
    name: Ремонт маяка
    requires: [welcome]
    permission: harbor.repair
    max-completions: 1               # default 1; 0 unlimited
    cooldown-seconds: 60             # measured after successful reward
    stages:
      - {type: COLLECT, material: GLASS, amount: 4}
      - {type: DELIVER, npc: keeper, material: GLASS, amount: 4}
      - {type: VISIT, world: npc_demo, x: 42, y: 78, z: 10, radius: 5}
      - {type: EVENT, event: lens_align}
    rewards:
      - {type: item, material: BREAD, amount: 3}
      - {type: money, amount: 8}
      - {type: variable, key: lighthouse_restored, value: true}
      - {type: block, world: npc_demo, x: 42, y: 79, z: 10, material: SEA_LANTERN}
```

Only the current stage records progress. Acceptance never immediately awards items. All stages must finish before `/npcs claim repair` or the `complete` action succeeds.

| Stage | Matching and consumption |
|---|---|
| `TALK` | `npc`; main-hand NPC interaction, one advancement per interaction |
| `COLLECT` | `material`, `amount`; checked once/second and on relevant actions; possession is enough, nothing consumed |
| `DELIVER` | `npc`, `material`, `amount`; ordinary storage items removed on NPC interaction; restored on persistence failure |
| `VISIT` | `world`, `x/y/z`, `radius` default 3; checked once/second |
| `BREAK` | `material`, `amount`; actual successful block-break events |
| `KILL` | `entity`, `amount`; living entity death credited to player killer |
| `EVENT` | `event`, `amount`; only plugin/API/declarative event actions |

BREAK/KILL/EVENT may also specify `world` and optional `x/y/z/radius` to constrain event locations. Progress cannot be incremented by a public player command. BREAK accepts that material regardless of growth age, so a wheat objective measures wheat blocks, not mature harvests. KILL measures server killer attribution, including projectile kills credited by Bukkit. Use a companion plugin and EVENT objectives for specialized rules.

Quest rewards support `item`, `money`, `variable`, `block`, `message`, `event` and trusted `command`. Recursive quest acceptance/claim rewards are rejected. Items, aggregate currency, loaded reward worlds and inventory capacity are checked before claiming. UUID state holds active flag, stage/count, accepted time, completed count, last completion and pending claim marker.

### Durability boundary and recovery

Progress uses write-through YAML, forced temporary-file writes and an atomic rename where the filesystem supports it. A failed write restores the previous in-memory snapshot and rejects the operation. Syntactically corrupt progress refuses plugin startup rather than silently resetting players. Back up `progress.yml` together with server player/world data.

Claims first persist a pending marker, then change inventory/economy/world blocks, then persist completion. Ordinary duplicate/offhand clicks and repeat claims are rejected. Synchronous failure restores inventory/block state and attempts to reverse a Vault deposit. If that reversal fails, the pending claim remains locked and the server log identifies the player/quest.

Minecraft inventory, external economy and plugin YAML do **not** share an ACID transaction. Power loss between writes can leave delivered or undelivered rewards with a pending marker. The plugin refuses automatic replay, preventing blind duplication. Administrators inspect actual inventory/economy/world state, then use `/npcs recover <uuid> <quest> completed` to record delivery or `unlock` to allow a retry. Do not unlock already delivered rewards. Trusted commands and post-commit messages/events run only after completion; external command side effects cannot be rolled back, and may be lost on a crash after completion. These limits apply to any plugin without a transactional shared ledger.

## Shops

```yaml
shops:
  market:
    permission: harbor.market
    goods:
      - {material: BREAD, amount: 3, buy: 2, sell: 1}
      - {material: GLASS, amount: 4, buy: 4}
```

Omit a price or set it negative to disable that direction. Goods may override `permission`. Buy checks funds and capacity after currency removal; sell checks the exact ordinary item quantity and capacity for native proceeds. Offhand/armor/custom named or enchanted items are excluded. A rejected Vault operation restores inventory; a failed compensating operation logs a manual reconciliation requirement. Shop trades are synchronous, scoped to authenticated NPC dialogue sessions, with a per-player reentry guard. Shops are repeatable and not durably journaled across server crashes.

## Optional integrations and extension API

- **Vault**: actual registered Economy service `has`, `withdrawPlayer`, `depositPlayer`, and `transactionSuccess`. Installing Vault alone supplies no money provider. `/npcs integrations` distinguishes plugin detection from provider presence.
- **PlaceholderAPI**: registered persistent `npcs` expansion exposing `%npcs_stage_<quest>%`, `%npcs_active_<quest>%`, `%npcs_completed_<quest>%`, `%npcs_variable_<key>%`; outgoing text also calls `setPlaceholders`.
- **WorldGuard 7 / WorldEdit 7 API**: adapts Bukkit locations and wraps players, creates a RegionQuery, and uses `testBuild` with the `INTERACT` StateFlag and honors WorldGuard bypass permissions on opening and choosing NPC actions. Query failure denies interaction. Existing protection plugins remain responsible for ordinary world block permissions and their event cancellations.
- **Citizens 2 API**: real registry create/spawn/destroy, protected flag, persistent ownership metadata, SkinTrait and Navigator calls. Adapter errors log the exact layer. Runtime compatibility still depends on the installed Citizens build and its server support.

Portable native code is compiled against Bukkit/Spigot API 1.16.5 with Java `--release 16`. This is a compilation baseline, not a statement that all server versions have been tested. Check `COMPATIBILITY.md` for actual runtime evidence. Optional adapters use their documented modern interfaces and are not guarantees for arbitrary old plugin versions.

```java
NpcApi api = Bukkit.getServicesManager().load(NpcApi.class);
api.acceptQuest(player, "repair");
api.signal(player, "lens_align");
api.claimQuest(player, "repair");
boolean active = api.isActive(player, "repair");
String stage = api.placeholder(player, "stage_repair");
```

API methods require the Bukkit main thread. Add `depend: [MinecraftNPCSystem]` to an extension plugin and compile against this JAR. `NpcInteractEvent` is cancellable and fires after built-in access checks, before TALK/DELIVER/dialogue. `QuestEvent` fires synchronously **after durable state commit** with ACCEPTED, STAGE or COMPLETED, player, quest ID and stage. Do not manually repeat an API signal for the same physical event; the caller owns event deduplication.

