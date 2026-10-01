package dev.velmren.npc;

import java.util.*;
import org.bukkit.*;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.entity.*;
import org.bukkit.persistence.PersistentDataType;

public final class NpcManager {
  private final MinecraftNpcPlugin plugin;
  private final NamespacedKey key;
  private final Map<String, Entity> entities = new HashMap<>();
  private final Map<String, Object> citizens = new HashMap<>();
  private final Map<String, Integer> routes = new HashMap<>();
  private long ticks;
  private boolean reconciling;

  public NpcManager(MinecraftNpcPlugin p) {
    plugin = p;
    key = new NamespacedKey(p, "npc-id");
  }

  public String id(Entity e) {
    return e.getPersistentDataContainer().get(key, PersistentDataType.STRING);
  }

  public Entity entity(String id) {
    return entities.get(id);
  }

  public void clear() {
    for (Entity e : entities.values()) if (e.isValid()) e.remove();
    entities.clear();
    for (Object n : citizens.values()) plugin.integrations.destroyCitizen(n);
    citizens.clear();
    routes.clear();
  }

  public void reload() {
    clear();
    plugin.integrations.cleanupCitizens();
    for (World w : Bukkit.getWorlds())
      for (Entity e : w.getEntities()) if (id(e) != null) e.remove();
    reconcile();
  }

  public void reconcile() {
    if (reconciling) return;
    reconciling = true;
    try {
      for (var entry : plugin.definitions.npcs.entrySet()) {
        String id = entry.getKey();
        var n = entry.getValue();
        if (!n.getBoolean("enabled", true)) continue;
        Entity old = entities.get(id);
        if (old != null && old.isValid()) continue;
        Location l = plugin.definitions.location(n);
        if (l == null) continue;
        Object previousCitizen = citizens.remove(id);
        if (previousCitizen != null) plugin.integrations.destroyCitizen(previousCitizen);
        Entity spawned = null;
        try {
          l.getChunk().load();
          Entity e;
          if (n.getString("backend", "native").equals("citizens")) {
            Object npc =
                plugin.integrations.spawnCitizen(
                    id,
                    n.getString("name", id),
                    EntityType.valueOf(n.getString("type", "VILLAGER").toUpperCase(Locale.ROOT)),
                    l,
                    n.getString("skin", ""));
            citizens.put(id, npc);
            e = plugin.integrations.citizenEntity(npc);
            spawned = e;
          } else {
            e =
                l.getWorld()
                    .spawnEntity(
                        l,
                        EntityType.valueOf(
                            n.getString("type", "VILLAGER").toUpperCase(Locale.ROOT)));
            spawned = e;
            e.setInvulnerable(true);
            e.setSilent(true);
            e.setPersistent(true);
            e.setCustomName(MinecraftNpcPlugin.color(n.getString("name", id)));
            e.setCustomNameVisible(true);
            if (e instanceof LivingEntity living) {
              living.setAI(false);
              living.setRemoveWhenFarAway(false);
              living.setCollidable(false);
            }
            if (e instanceof Villager v) {
              v.setProfession(
                  Villager.Profession.valueOf(
                      n.getString("profession", "NONE").toUpperCase(Locale.ROOT)));
              v.setVillagerType(
                  Villager.Type.valueOf(
                      n.getString("villager-type", "PLAINS").toUpperCase(Locale.ROOT)));
            }
          }
          e.getPersistentDataContainer().set(key, PersistentDataType.STRING, id);
          entities.put(id, e);
        } catch (Exception | LinkageError e) {
          if (spawned != null) spawned.remove();
          Object failed = citizens.remove(id);
          if (failed != null) plugin.integrations.destroyCitizen(failed);
          plugin.getLogger().warning("NPC " + id + " spawn failed: " + e.getMessage());
        }
      }
    } finally {
      reconciling = false;
    }
  }

  public void chunkLoaded(org.bukkit.Chunk chunk) {
    for (Entity e : chunk.getEntities()) {
      String id = id(e);
      if (id == null) continue;
      Entity known = entities.get(id);
      if (known == null || !known.getUniqueId().equals(e.getUniqueId())) e.remove();
    }
    reconcile();
  }

  public void tick() {
    ticks++;
    if (ticks % 100 == 0) reconcile();
    for (var entry : entities.entrySet()) {
      String id = entry.getKey();
      Entity e = entry.getValue();
      ConfigurationSection n = plugin.definitions.npcs.get(id);
      if (n == null || !e.isValid() || ticks % n.getInt("interval", 10) != 0) continue;
      var route = n.getMapList("route");
      if (!route.isEmpty()) {
        int i = routes.getOrDefault(id, 0) % route.size();
        Location target = plugin.definitions.location(n);
        var point = Definitions.section(route.get(i));
        target.setX(point.getDouble("x"));
        target.setY(point.getDouble("y"));
        target.setZ(point.getDouble("z"));
        if (e.getLocation().distanceSquared(target) < 0.5) routes.put(id, (i + 1) % route.size());
        else if (citizens.containsKey(id)) {
          try {
            plugin.integrations.navigate(citizens.get(id), target);
          } catch (Exception x) {
            plugin.getLogger().warning("Citizens navigation: " + x.getMessage());
          }
        } else {
          Location from = e.getLocation();
          org.bukkit.util.Vector delta = target.toVector().subtract(from.toVector());
          double speed = Math.min(n.getDouble("speed", 0.15), delta.length());
          if (speed > 0 && Double.isFinite(speed)) {
            Location next = from.clone().add(delta.normalize().multiply(speed));
            if (next.getBlock().isPassable() && next.clone().add(0, 1, 0).getBlock().isPassable())
              e.teleport(next);
          }
        }
      }
      double radius = n.getDouble("look-radius", 8);
      Player nearest = null;
      double best = radius * radius;
      for (Player p : e.getWorld().getPlayers()) {
        double d = p.getLocation().distanceSquared(e.getLocation());
        if (d < best) {
          best = d;
          nearest = p;
        }
      }
      if (nearest != null) {
        Location at = e.getLocation();
        at.setDirection(
            nearest
                .getEyeLocation()
                .toVector()
                .subtract((e instanceof LivingEntity l ? l.getEyeLocation() : at).toVector()));
        e.teleport(at);
      }
    }
  }
}
