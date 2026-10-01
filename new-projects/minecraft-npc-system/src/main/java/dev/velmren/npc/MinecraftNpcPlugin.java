package dev.velmren.npc;

import dev.velmren.npc.api.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import org.bukkit.*;
import org.bukkit.command.*;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.*;
import org.bukkit.event.*;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.entity.*;
import org.bukkit.event.inventory.*;
import org.bukkit.event.player.*;
import org.bukkit.event.server.*;
import org.bukkit.event.world.*;
import org.bukkit.inventory.EquipmentSlot;
import org.bukkit.plugin.ServicePriority;
import org.bukkit.plugin.java.JavaPlugin;

public final class MinecraftNpcPlugin extends JavaPlugin
    implements Listener, CommandExecutor, TabCompleter, NpcApi {
  public Definitions definitions;
  public ProgressStore progress;
  public Integrations integrations;
  public NpcManager npcs;
  public QuestEngine quests;
  public ShopEngine shops;
  public DialogueEngine dialogue;
  private final Map<UUID, Long> interactionTimes = new HashMap<>();
  private File definitionFile;
  private long clockTick;

  @Override
  public void onEnable() {
    try {
      saveDefaultConfig();
      for (String resource : List.of("npcs.yml", "dialogs.yml", "quests.yml", "shops.yml"))
        if (!new File(getDataFolder(), resource).exists()
            && !getConfig().isConfigurationSection(resource.substring(0, resource.length() - 4)))
          saveResource(resource, false);
      definitionFile = new File(getDataFolder(), "config.yml");
      definitions = Definitions.load(definitionFile);
      progress = new ProgressStore(getDataFolder().toPath().resolve("progress.yml"));
      integrations = new Integrations(this);
      quests = new QuestEngine(this);
      shops = new ShopEngine(this);
      dialogue = new DialogueEngine(this);
      npcs = new NpcManager(this);
      Bukkit.getPluginManager().registerEvents(this, this);
      getCommand("npcs").setExecutor(this);
      getCommand("npcs").setTabCompleter(this);
      Bukkit.getServicesManager().register(NpcApi.class, this, this, ServicePriority.Normal);
      npcs.reload();
      Bukkit.getScheduler()
          .runTaskTimer(
              this,
              () -> {
                npcs.tick();
                if (++clockTick % 20 == 0)
                  for (Player p : Bukkit.getOnlinePlayers()) quests.poll(p);
              },
              1,
              1);
      getLogger().info("NPC system enabled: " + definitions.npcs.size() + " NPC definitions");
    } catch (Exception | LinkageError e) {
      getLogger().severe("Startup refused: " + e.getMessage());
      Bukkit.getPluginManager().disablePlugin(this);
    }
  }

  @Override
  public void onDisable() {
    if (npcs != null) npcs.clear();
    if (dialogue != null) dialogue.clear();
    if (integrations != null) integrations.close();
    Bukkit.getServicesManager().unregisterAll(this);
  }

  public static String color(String s) {
    return ChatColor.translateAlternateColorCodes('&', s == null ? "" : s);
  }

  public void tell(CommandSender p, String s) {
    p.sendMessage(color("&6[NPC] &f" + s));
  }

  public void failure(CommandSender p, Exception x) {
    tell(p, "Operation failed. " + x.getMessage());
    getLogger().warning(x.toString());
  }

  private void mainThread() {
    if (!Bukkit.isPrimaryThread())
      throw new IllegalStateException("NpcApi must be called on the server main thread");
  }

  public boolean acceptQuest(Player p, String q) {
    mainThread();
    return quests.accept(p, q);
  }

  public boolean claimQuest(Player p, String q) {
    mainThread();
    return quests.claim(p, q);
  }

  public void signal(Player p, String e) {
    mainThread();
    quests.increment(p, "EVENT", e, p.getLocation());
  }

  public boolean isActive(Player p, String q) {
    mainThread();
    return quests.active(p, q);
  }

  public boolean isCompleted(Player p, String q) {
    mainThread();
    return quests.completed(p, q);
  }

  public String placeholder(Player p, String id) {
    mainThread();
    if (id.startsWith("variable_"))
      return progress.string(p.getUniqueId(), "variables." + id.substring(9));
    if (id.startsWith("stage_")) return String.valueOf(quests.stage(p, id.substring(6)));
    if (id.startsWith("completed_")) return String.valueOf(quests.completed(p, id.substring(10)));
    if (id.startsWith("active_")) return String.valueOf(quests.active(p, id.substring(7)));
    return "";
  }

  private boolean reloadDefinitions(CommandSender sender) {
    try {
      Definitions candidate = Definitions.load(definitionFile);
      definitions = candidate;
      dialogue.clear();
      integrations.probe();
      npcs.reload();
      tell(sender, "Configuration validated and reloaded.");
      return true;
    } catch (Exception x) {
      tell(sender, "Reload rejected; current configuration retained: " + x.getMessage());
      return false;
    }
  }

  @Override
  public boolean onCommand(CommandSender sender, Command command, String label, String[] a) {
    if (a.length == 0 || a[0].equalsIgnoreCase("help")) {
      tell(sender, "/npcs quests | accept <quest> | claim <quest> | choose <token> <index>");
      if (sender.hasPermission("npcs.admin"))
        tell(
            sender,
            "Admin: list | reload | integrations | create <id> | remove <id> | set <id> <field>"
                + " <value> | teleport <id> | spawn <id> | despawn <id> | demo install [confirm] |"
                + " recover <uuid> <quest> <unlock|completed>");
      return true;
    }
    try {
      String sub = a[0].toLowerCase(Locale.ROOT);
      if (Set.of("quests", "accept", "claim", "choose").contains(sub)) {
        if (!(sender instanceof Player p) || !p.hasPermission("npcs.use")) {
          tell(sender, "Player permission npcs.use required.");
          return true;
        }
        switch (sub) {
          case "quests" -> quests.status(p);
          case "accept" -> {
            if (a.length > 1) quests.accept(p, a[1]);
          }
          case "claim" -> {
            if (a.length > 1) quests.claim(p, a[1]);
          }
          case "choose" -> {
            if (a.length == 3) dialogue.choose(p, a[1], Integer.parseInt(a[2]));
          }
        }
        return true;
      }
      if (!sender.hasPermission("npcs.admin")) {
        tell(sender, "Administrator permission required.");
        return true;
      }
      switch (sub) {
        case "integrations" -> tell(sender, integrations.diagnostics());
        case "reload" -> reloadDefinitions(sender);
        case "list" -> {
          for (var e : definitions.npcs.entrySet())
            tell(
                sender,
                e.getKey()
                    + ": "
                    + e.getValue().getString("world")
                    + " "
                    + (npcs.entity(e.getKey()) != null ? "spawned" : "unloaded/disabled"));
        }
        case "create" -> {
          if (a.length < 2 || !(sender instanceof Player p)) break;
          if (definitions.npcs.containsKey(a[1])) throw new IllegalArgumentException("NPC exists");
          YamlConfiguration y = copyConfig();
          String b = "npcs." + a[1] + ".";
          Location l = p.getLocation();
          y.set(b + "name", a[1]);
          y.set(b + "world", l.getWorld().getName());
          y.set(b + "x", l.getX());
          y.set(b + "y", l.getY());
          y.set(b + "z", l.getZ());
          y.set(b + "yaw", l.getYaw());
          y.set(b + "type", "VILLAGER");
          y.set(b + "enabled", true);
          commitConfig(y, sender);
        }
        case "remove" -> {
          if (a.length < 2) break;
          requireNpc(a[1]);
          YamlConfiguration y = copyConfig();
          y.set("npcs." + a[1], null);
          commitConfig(y, sender);
        }
        case "set" -> {
          if (a.length < 4) break;
          requireNpc(a[1]);
          Set<String> fields =
              Set.of(
                  "name",
                  "world",
                  "x",
                  "y",
                  "z",
                  "yaw",
                  "pitch",
                  "enabled",
                  "type",
                  "backend",
                  "dialogue",
                  "shop",
                  "permission",
                  "profession",
                  "villager-type",
                  "skin",
                  "look-radius",
                  "interval",
                  "speed");
          if (!fields.contains(a[2]))
            throw new IllegalArgumentException("Unsupported field; edit YAML for route and graphs");
          String value = String.join(" ", Arrays.copyOfRange(a, 3, a.length));
          Object val = value;
          if (Set.of("x", "y", "z", "yaw", "pitch", "look-radius", "speed").contains(a[2]))
            val = Double.parseDouble(value);
          if (a[2].equals("interval")) val = Integer.parseInt(value);
          if (a[2].equals("enabled")) {
            if (!Set.of("true", "false").contains(value))
              throw new IllegalArgumentException("Boolean required");
            val = Boolean.parseBoolean(value);
          }
          YamlConfiguration y = copyConfig();
          y.set("npcs." + a[1] + "." + a[2], val);
          commitConfig(y, sender);
        }
        case "spawn", "despawn" -> {
          if (a.length < 2) break;
          requireNpc(a[1]);
          YamlConfiguration y = copyConfig();
          y.set("npcs." + a[1] + ".enabled", sub.equals("spawn"));
          commitConfig(y, sender);
        }
        case "teleport" -> {
          if (a.length < 2 || !(sender instanceof Player p)) break;
          requireNpc(a[1]);
          Location l = definitions.location(definitions.npcs.get(a[1]));
          if (l == null) throw new IllegalArgumentException("NPC world is not loaded");
          p.teleport(l);
        }
        case "demo" -> {
          if (a.length < 2 || !a[1].equals("install")) break;
          File folder = new File(Bukkit.getWorldContainer(), "npc_demo");
          if (folder.exists() && (a.length < 3 || !a[2].equals("confirm"))) {
            tell(sender, "Demo world already exists. Rebuild only with /npcs demo install confirm");
            break;
          }
          World w =
              Bukkit.createWorld(
                  new WorldCreator("npc_demo").type(WorldType.FLAT).generateStructures(false));
          if (w == null) throw new IllegalStateException("Could not create demo world");
          Location spawn = DemoWorld.build(w);
          w.setSpawnLocation(spawn);
          npcs.reload();
          if (sender instanceof Player p) p.teleport(spawn);
          w.save();
          tell(sender, "Dedicated npc_demo harbor installed. Eight configured NPCs ready.");
        }
        case "recover" -> {
          if (a.length != 4) break;
          UUID uuid = UUID.fromString(a[1]);
          String q = a[2];
          if (!definitions.quests.containsKey(q))
            throw new IllegalArgumentException("Unknown quest");
          String b = "quests." + q + ".";
          if (!progress.flag(uuid, b + "claim-pending"))
            throw new IllegalArgumentException("No pending claim");
          if (a[3].equals("unlock")) progress.set(uuid, b + "claim-pending", false);
          else if (a[3].equals("completed"))
            progress.change(
                uuid,
                Map.of(
                    b + "claim-pending",
                    false,
                    b + "active",
                    false,
                    b + "completions",
                    progress.integer(uuid, b + "completions") + 1,
                    b + "last-completed",
                    System.currentTimeMillis()));
          else
            throw new IllegalArgumentException(
                "Use unlock or completed after inspecting delivered rewards");
          tell(sender, "Recovery state committed for " + uuid);
        }
        default -> tell(sender, "Unknown command; /npcs help");
      }
    } catch (Exception x) {
      failure(sender, x);
    }
    return true;
  }

  private void requireNpc(String id) {
    if (!definitions.npcs.containsKey(id)) throw new IllegalArgumentException("Unknown NPC " + id);
  }

  private YamlConfiguration copyConfig() throws Exception {
    YamlConfiguration y = new YamlConfiguration();
    y.loadFromString(definitions.yaml.saveToString());
    return y;
  }

  private void commitConfig(YamlConfiguration y, CommandSender sender) throws Exception {
    Definitions next = Definitions.parse(y.saveToString());
    YamlConfiguration part = new YamlConfiguration();
    part.set("npcs", y.getConfigurationSection("npcs"));
    Path file = getDataFolder().toPath().resolve("npcs.yml"),
        tmp = file.resolveSibling("npcs.yml.tmp");
    Files.writeString(tmp, part.saveToString(), java.nio.charset.StandardCharsets.UTF_8);
    try {
      Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
    } catch (AtomicMoveNotSupportedException x) {
      Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING);
    }
    definitions = next;
    dialogue.clear();
    npcs.reload();
    tell(sender, "NPC configuration saved.");
  }

  public List<String> onTabComplete(CommandSender s, Command c, String l, String[] a) {
    List<String> choices = new ArrayList<>();
    if (a.length == 1) {
      choices.addAll(List.of("help", "quests", "accept", "claim"));
      if (s.hasPermission("npcs.admin"))
        choices.addAll(
            List.of(
                "reload",
                "list",
                "create",
                "remove",
                "set",
                "spawn",
                "despawn",
                "teleport",
                "demo",
                "recover"));
    } else if (a.length == 2) {
      if (Set.of("accept", "claim").contains(a[0])) choices.addAll(definitions.quests.keySet());
      else if (s.hasPermission("npcs.admin")) choices.addAll(definitions.npcs.keySet());
    }
    String last = a[a.length - 1].toLowerCase(Locale.ROOT);
    return choices.stream().filter(x -> x.startsWith(last)).toList();
  }

  @EventHandler(priority = EventPriority.HIGHEST)
  public void interact(PlayerInteractEntityEvent e) {
    String id = npcs.id(e.getRightClicked());
    if (id == null) return;
    e.setCancelled(true);
    if (e.getHand() != EquipmentSlot.HAND) return;
    Player p = e.getPlayer();
    long tick = System.nanoTime();
    if (tick - interactionTimes.getOrDefault(p.getUniqueId(), 0L) < 250_000_000) return;
    interactionTimes.put(p.getUniqueId(), tick);
    if (!p.hasPermission("npcs.use")
        || p.getLocation().distanceSquared(e.getRightClicked().getLocation())
            > Math.pow(definitions.yaml.getDouble("interaction-distance", 6), 2)
        || !integrations.allowed(p, e.getRightClicked().getLocation())) return;
    var n = definitions.npcs.get(id);
    if (n == null) return;
    String permission = n.getString("permission", "");
    if (!permission.isBlank() && !p.hasPermission(permission)) return;
    NpcInteractEvent event = new NpcInteractEvent(p, id);
    Bukkit.getPluginManager().callEvent(event);
    if (event.isCancelled()) return;
    quests.talk(p, id);
    dialogue.open(p, id);
  }

  @EventHandler(priority = EventPriority.HIGHEST)
  public void click(InventoryClickEvent e) {
    if (!(e.getView().getTopInventory().getHolder() instanceof DialogueEngine.Menu m)) return;
    e.setCancelled(true);
    if (!(e.getWhoClicked() instanceof Player p)
        || !m.player.equals(p.getUniqueId())
        || e.getRawSlot() < 0
        || e.getRawSlot() >= e.getView().getTopInventory().getSize()
        || e.getCurrentItem() == null) return;
    int index = e.getRawSlot();
    Bukkit.getScheduler().runTask(this, () -> dialogue.choose(p, m.token, index));
  }

  @EventHandler
  public void drag(InventoryDragEvent e) {
    if (e.getView().getTopInventory().getHolder() instanceof DialogueEngine.Menu)
      e.setCancelled(true);
  }

  @EventHandler(priority = EventPriority.HIGHEST)
  public void damage(EntityDamageEvent e) {
    if (npcs.id(e.getEntity()) != null) e.setCancelled(true);
  }

  @EventHandler(priority = EventPriority.HIGHEST)
  public void target(EntityTargetEvent e) {
    if (npcs.id(e.getEntity()) != null || (e.getTarget() != null && npcs.id(e.getTarget()) != null))
      e.setCancelled(true);
  }

  @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
  public void broken(BlockBreakEvent e) {
    quests.increment(
        e.getPlayer(), "BREAK", e.getBlock().getType().name(), e.getBlock().getLocation());
  }

  @EventHandler(priority = EventPriority.MONITOR)
  public void killed(EntityDeathEvent e) {
    Player p = e.getEntity().getKiller();
    if (p != null && npcs.id(e.getEntity()) == null)
      quests.increment(p, "KILL", e.getEntityType().name(), e.getEntity().getLocation());
  }

  @EventHandler
  public void chunk(ChunkLoadEvent e) {
    Bukkit.getScheduler().runTask(this, () -> npcs.chunkLoaded(e.getChunk()));
  }

  @EventHandler
  public void world(WorldLoadEvent e) {
    Bukkit.getScheduler().runTask(this, () -> npcs.reconcile());
  }

  @EventHandler
  public void quit(PlayerQuitEvent e) {
    dialogue.leave(e.getPlayer());
    interactionTimes.remove(e.getPlayer().getUniqueId());
  }

  private void refreshAdapters() {
    if (!isEnabled()) return;
    Bukkit.getScheduler()
        .runTask(
            this,
            () -> {
              if (isEnabled()) integrations.probe();
            });
  }

  @EventHandler
  public void providerRegistered(ServiceRegisterEvent e) {
    refreshAdapters();
  }

  @EventHandler
  public void providerUnregistered(ServiceUnregisterEvent e) {
    refreshAdapters();
  }

  @EventHandler
  public void pluginEnabled(PluginEnableEvent e) {
    if (Set.of("Vault", "Citizens", "WorldGuard", "PlaceholderAPI")
        .contains(e.getPlugin().getName())) refreshAdapters();
  }

  @EventHandler
  public void pluginDisabled(PluginDisableEvent e) {
    if (Set.of("Vault", "Citizens", "WorldGuard", "PlaceholderAPI")
        .contains(e.getPlugin().getName())) refreshAdapters();
  }
}
