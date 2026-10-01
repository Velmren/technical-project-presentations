package dev.velmren.npc;

import dev.velmren.npc.api.*;
import java.util.*;
import org.bukkit.*;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

public final class QuestEngine {
  private final MinecraftNpcPlugin plugin;
  private final Set<UUID> busy = new HashSet<>();

  public QuestEngine(MinecraftNpcPlugin p) {
    plugin = p;
  }

  private ProgressStore store() {
    return plugin.progress;
  }

  private String base(String q) {
    return "quests." + q + ".";
  }

  public boolean active(Player p, String q) {
    return store().flag(p.getUniqueId(), base(q) + "active");
  }

  public boolean completed(Player p, String q) {
    return store().integer(p.getUniqueId(), base(q) + "completions") > 0;
  }

  public int stage(Player p, String q) {
    return store().integer(p.getUniqueId(), base(q) + "stage");
  }

  public boolean accept(Player p, String id) {
    var q = plugin.definitions.quests.get(id);
    if (q == null) return false;
    UUID u = p.getUniqueId();
    String b = base(id);
    if (active(p, id)) {
      plugin.tell(p, "Quest already active.");
      return false;
    }
    if (store().flag(u, b + "claim-pending")) {
      plugin.tell(p, "A reward recovery is pending; ask an administrator.");
      return false;
    }
    int max = q.getInt("max-completions", 1);
    if (max > 0 && store().integer(u, b + "completions") >= max) {
      plugin.tell(p, "Quest completion limit reached.");
      return false;
    }
    if (System.currentTimeMillis() - store().number(u, b + "last-completed")
        < q.getLong("cooldown-seconds", 0) * 1000) {
      plugin.tell(p, "Quest is on cooldown.");
      return false;
    }
    String permission = q.getString("permission", "");
    if (!permission.isEmpty() && !p.hasPermission(permission)) {
      plugin.tell(p, "You lack quest permission.");
      return false;
    }
    for (String dep : q.getStringList("requires"))
      if (!completed(p, dep)) {
        plugin.tell(p, "Complete " + dep + " first.");
        return false;
      }
    try {
      store()
          .change(
              u,
              Map.of(
                  b + "active",
                  true,
                  b + "stage",
                  0,
                  b + "count",
                  0,
                  b + "accepted",
                  System.currentTimeMillis()));
      plugin.tell(p, "Quest accepted: " + q.getString("name", id));
      event(p, id, QuestEvent.Kind.ACCEPTED);
      poll(p);
      return true;
    } catch (Exception x) {
      plugin.failure(p, x);
      return false;
    }
  }

  public void poll(Player p) {
    for (String id : plugin.definitions.quests.keySet()) {
      var s = current(p, id);
      if (s == null) continue;
      String type = s.getString("type", "").toUpperCase(Locale.ROOT);
      if (type.equals("COLLECT")) {
        if (InventoryOps.count(p.getInventory(), Definitions.material(s.getString("material")))
            >= s.getInt("amount", 1)) advance(p, id);
      } else if (type.equals("VISIT")) {
        Location l = plugin.definitions.location(s);
        if (l != null
            && p.getWorld() == l.getWorld()
            && p.getLocation().distanceSquared(l) <= Math.pow(s.getDouble("radius", 3), 2))
          advance(p, id);
      }
    }
  }

  private ConfigurationSection current(Player p, String id) {
    if (!active(p, id)) return null;
    var q = plugin.definitions.quests.get(id);
    if (q == null) return null;
    var stages = q.getMapList("stages");
    int i = stage(p, id);
    return i >= stages.size() ? null : Definitions.section(stages.get(i));
  }

  public void talk(Player p, String npc) {
    for (String id : plugin.definitions.quests.keySet()) {
      var s = current(p, id);
      if (s == null || !s.getString("npc", "").equals(npc)) continue;
      String type = s.getString("type", "").toUpperCase(Locale.ROOT);
      if (type.equals("TALK")) advance(p, id);
      if (type.equals("DELIVER")) {
        Material m = Definitions.material(s.getString("material"));
        int amount = s.getInt("amount", 1);
        if (InventoryOps.count(p.getInventory(), m) < amount) {
          plugin.tell(p, "Bring " + amount + " " + m.name().toLowerCase(Locale.ROOT) + ".");
          continue;
        }
        ItemStack[] before = InventoryOps.copy(p.getInventory());
        InventoryOps.remove(p.getInventory(), m, amount);
        if (!advance(p, id)) p.getInventory().setStorageContents(before);
      }
    }
    poll(p);
  }

  public void increment(Player p, String type, String target, Location loc) {
    for (String id : plugin.definitions.quests.keySet()) {
      var s = current(p, id);
      if (s == null || !s.getString("type", "").equalsIgnoreCase(type)) continue;
      String key = type.equals("BREAK") ? "material" : type.equals("KILL") ? "entity" : "event";
      if (!s.getString(key, "").equalsIgnoreCase(target)) continue;
      String world = s.getString("world", "");
      if (!world.isEmpty() && (loc == null || !world.equals(loc.getWorld().getName()))) continue;
      if (s.contains("radius") && loc != null) {
        Location center = plugin.definitions.location(s);
        if (center == null
            || center.getWorld() != loc.getWorld()
            || center.distanceSquared(loc) > Math.pow(s.getDouble("radius"), 2)) continue;
      }
      int count = store().integer(p.getUniqueId(), base(id) + "count") + 1;
      if (count >= s.getInt("amount", 1)) advance(p, id);
      else
        try {
          store().set(p.getUniqueId(), base(id) + "count", count);
        } catch (Exception x) {
          plugin.failure(p, x);
        }
    }
  }

  private boolean advance(Player p, String id) {
    int next = stage(p, id) + 1;
    try {
      store().change(p.getUniqueId(), Map.of(base(id) + "stage", next, base(id) + "count", 0));
      plugin.tell(p, "Quest " + id + ": stage " + next + " complete.");
      event(p, id, QuestEvent.Kind.STAGE);
      if (next >= plugin.definitions.quests.get(id).getMapList("stages").size())
        plugin.tell(p, "All stages complete. Claim with /npcs claim " + id);
      return true;
    } catch (Exception x) {
      plugin.failure(p, x);
      return false;
    }
  }

  public boolean claim(Player p, String id) {
    var q = plugin.definitions.quests.get(id);
    UUID u = p.getUniqueId();
    String b = base(id);
    if (q == null
        || !active(p, id)
        || stage(p, id) < q.getMapList("stages").size()
        || store().flag(u, b + "claim-pending")
        || !busy.add(u)) {
      plugin.tell(p, "Reward is unavailable.");
      return false;
    }
    try {
      List<ItemStack> gifts = new ArrayList<>();
      double money = 0;
      Map<String, Object> finalState = new HashMap<>();
      Map<org.bukkit.block.Block, org.bukkit.block.data.BlockData> blocks = new LinkedHashMap<>();
      List<Map<?, ?>> rewards = q.getMapList("rewards");
      for (Map<?, ?> raw : rewards) {
        var a = Definitions.section(raw);
        switch (a.getString("type", "")) {
          case "item" ->
              gifts.add(
                  new ItemStack(
                      Definitions.material(a.getString("material")), a.getInt("amount", 1)));
          case "money" -> money += a.getDouble("amount");
          case "variable" -> finalState.put("variables." + a.getString("key"), a.get("value"));
          case "block" -> {
            Location l = plugin.definitions.location(a);
            if (l == null) throw new IllegalStateException("Reward world is not loaded");
            blocks.put(l.getBlock(), l.getBlock().getBlockData().clone());
          }
          default -> {}
        }
      }
      boolean emerald = plugin.definitions.yaml.getString("economy", "emerald").equals("emerald");
      if (emerald && money > 0) {
        if (money != Math.floor(money) || money > 2304)
          throw new IllegalStateException("Emerald rewards require whole amount <=2304");
        gifts.add(new ItemStack(Material.EMERALD, (int) money));
      }
      if (!InventoryOps.fits(p.getInventory(), gifts)) {
        plugin.tell(p, "Make room for the full reward.");
        return false;
      }
      ItemStack[] inventory = InventoryOps.copy(p.getInventory());
      boolean paid = false;
      store().set(u, b + "claim-pending", true);
      try {
        if (!emerald && money > 0) {
          if (!plugin.integrations.money(p, money, false))
            throw new IllegalStateException("Economy deposit failed");
          paid = true;
        }
        for (ItemStack gift : gifts)
          InventoryOps.give(p.getInventory(), gift.getType(), gift.getAmount());
        for (Map<?, ?> raw : rewards) {
          var a = Definitions.section(raw);
          if (a.getString("type", "").equals("block"))
            plugin
                .definitions
                .location(a)
                .getBlock()
                .setType(Material.matchMaterial(a.getString("material")), false);
        }
        finalState.put(b + "active", false);
        finalState.put(b + "completions", store().integer(u, b + "completions") + 1);
        finalState.put(b + "last-completed", System.currentTimeMillis());
        finalState.put(b + "claim-pending", false);
        store().change(u, finalState);
      } catch (Exception x) {
        p.getInventory().setStorageContents(inventory);
        for (var block : blocks.entrySet()) block.getKey().setBlockData(block.getValue(), false);
        boolean rollback = true;
        if (paid) rollback = plugin.integrations.money(p, money, true);
        if (rollback)
          try {
            store().set(u, b + "claim-pending", false);
          } catch (Exception write) {
            plugin
                .getLogger()
                .severe("Reward recovery marker could not be cleared: " + write.getMessage());
          }
        else
          plugin
              .getLogger()
              .severe(
                  "Economy reward rollback failed for " + u + " " + id + "; claim remains locked");
        throw x;
      }
      plugin.tell(p, "Quest rewarded: " + q.getString("name", id));
      event(p, id, QuestEvent.Kind.COMPLETED);
      for (Map<?, ?> raw : rewards) {
        var a = Definitions.section(raw);
        if (Set.of("message", "command", "event").contains(a.getString("type", "")))
          plugin.dialogue.action(p, a);
      }
      return true;
    } catch (Exception x) {
      plugin.failure(p, x);
      return false;
    } finally {
      busy.remove(u);
    }
  }

  private void event(Player p, String q, QuestEvent.Kind kind) {
    Bukkit.getPluginManager().callEvent(new QuestEvent(p, q, kind, stage(p, q)));
  }

  public void status(Player p) {
    for (var e : plugin.definitions.quests.entrySet()) {
      String id = e.getKey();
      if (active(p, id)) {
        var s = current(p, id);
        plugin.tell(
            p,
            id
                + ": "
                + (s == null
                    ? "ready to claim"
                    : "stage "
                        + (stage(p, id) + 1)
                        + " "
                        + s.getString("type")
                        + " "
                        + store().integer(p.getUniqueId(), base(id) + "count")
                        + "/"
                        + s.getInt("amount", 1)));
      } else if (completed(p, id))
        plugin.tell(
            p,
            id
                + ": completed ("
                + store().integer(p.getUniqueId(), base(id) + "completions")
                + ")");
    }
  }
}
