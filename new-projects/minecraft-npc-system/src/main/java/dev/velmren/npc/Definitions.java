package dev.velmren.npc;

import java.io.File;
import java.util.*;
import org.bukkit.*;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.EntityType;

/** An immutable-by-ownership snapshot: never mutate an active configuration. */
public final class Definitions {
  public final YamlConfiguration yaml;
  public final Map<String, ConfigurationSection> npcs, dialogs, quests, shops;

  private Definitions(YamlConfiguration y) {
    yaml = y;
    npcs = sections(y, "npcs");
    dialogs = sections(y, "dialogs");
    quests = sections(y, "quests");
    shops = sections(y, "shops");
    validate();
  }

  public static Definitions load(File f) throws Exception {
    YamlConfiguration y = new YamlConfiguration();
    y.load(f);
    for (String key : List.of("npcs", "dialogs", "quests", "shops")) {
      File part = new File(f.getParentFile(), key + ".yml");
      if (part.exists()) {
        YamlConfiguration p = new YamlConfiguration();
        p.load(part);
        if (p.getConfigurationSection(key) == null)
          fail(part.getName() + " requires root section " + key);
        y.set(key, p.getConfigurationSection(key));
      } else if (y.getConfigurationSection(key) == null)
        fail("Required configuration file missing: " + part.getName());
    }
    return new Definitions(y);
  }

  public static Definitions parse(String s) throws Exception {
    YamlConfiguration y = new YamlConfiguration();
    y.loadFromString(s);
    return new Definitions(y);
  }

  static Map<String, ConfigurationSection> sections(ConfigurationSection c, String key) {
    Map<String, ConfigurationSection> out = new LinkedHashMap<>();
    ConfigurationSection s = c.getConfigurationSection(key);
    if (s != null)
      for (String id : s.getKeys(false)) {
        if (!id.matches("[a-zA-Z0-9_-]+")) fail("Invalid ID " + id);
        ConfigurationSection v = s.getConfigurationSection(id);
        if (v == null) fail(key + "." + id + " must be a section");
        out.put(id, v);
      }
    return Collections.unmodifiableMap(out);
  }

  public static ConfigurationSection section(Map<?, ?> m) {
    YamlConfiguration y = new YamlConfiguration();
    for (var e : m.entrySet()) y.set(String.valueOf(e.getKey()), e.getValue());
    return y;
  }

  static void fail(String s) {
    throw new IllegalArgumentException(s);
  }

  public static Material material(String name) {
    Material m = Material.matchMaterial(name == null ? "" : name);
    if (m == null || !m.isItem()) fail("Unknown item material: " + name);
    return m;
  }

  static void ref(Map<String, ?> map, String id, String where) {
    if (id != null && !id.isEmpty() && !map.containsKey(id)) fail(where + ": missing " + id);
  }

  static void requiredRef(Map<String, ?> map, String id, String where) {
    if (id == null || id.isBlank()) fail(where + ": target ID required");
    ref(map, id, where);
  }

  static void key(String key, String where) {
    if (key == null || !key.matches("[a-zA-Z0-9_-]+"))
      fail(where + ": key required (letters, numbers, _ or -)");
  }

  static void coordinates(ConfigurationSection s, String where, boolean required) {
    for (String k : List.of("x", "y", "z")) {
      if ((required || s.contains(k)) && !(s.get(k) instanceof Number))
        fail(where + ": numeric " + k + " required");
      if (!Double.isFinite(s.getDouble(k))) fail(where + ": nonfinite coordinate");
    }
  }

  static List<Map<?, ?>> maps(ConfigurationSection c, String key) {
    if (!c.contains(key)) return List.of();
    if (!(c.get(key) instanceof List<?> list)) fail(key + " must be a list");
    for (Object entry : c.getList(key))
      if (!(entry instanceof Map<?, ?>)) fail(key + " entries must be mappings");
    return c.getMapList(key);
  }

  static void number(ConfigurationSection c, String key, double min, double max, boolean integral) {
    if (!c.contains(key)) return;
    if (!(c.get(key) instanceof Number)) fail(key + " must be numeric");
    double value = c.getDouble(key);
    if (!Double.isFinite(value)
        || value < min
        || value > max
        || (integral && value != Math.floor(value))) fail("Invalid " + key);
  }

  private void validate() {
    number(yaml, "interaction-distance", 0.1, 64, false);
    number(yaml, "session-seconds", 1, 3600, true);
    if (!Set.of("emerald", "vault").contains(yaml.getString("economy", "emerald")))
      fail("economy must be emerald or vault");
    double distance = yaml.getDouble("interaction-distance", 6);
    if (!Double.isFinite(distance) || distance <= 0 || distance > 64)
      fail("interaction-distance must be >0 and <=64");
    if (yaml.getLong("session-seconds", 90) < 1 || yaml.getLong("session-seconds", 90) > 3600)
      fail("session-seconds must be 1..3600");
    for (var e : npcs.entrySet()) {
      var n = e.getValue();
      String p = "NPC " + e.getKey();
      if (n.getString("world", "").isBlank()) fail(p + " needs world");
      String backend = n.getString("backend", "native");
      if (!Set.of("native", "citizens").contains(backend)) fail(p + " unknown backend");
      EntityType type;
      try {
        type = EntityType.valueOf(n.getString("type", "VILLAGER").toUpperCase(Locale.ROOT));
      } catch (Exception x) {
        throw new IllegalArgumentException(p + " invalid type");
      }
      if (type == EntityType.PLAYER) {
        if (!backend.equals("citizens")) fail(p + " PLAYER requires Citizens");
      } else if (!type.isAlive() || !type.isSpawnable()) fail(p + " needs a spawnable living type");
      coordinates(n, p, true);
      for (String field : List.of("yaw", "pitch"))
        number(n, field, -Float.MAX_VALUE, Float.MAX_VALUE, false);
      number(n, "look-radius", 0, 128, false);
      number(n, "interval", 1, 1200, true);
      number(n, "speed", 0.0001, 1, false);
      if (n.contains("enabled") && !(n.get("enabled") instanceof Boolean))
        fail(p + " enabled must be boolean");
      try {
        org.bukkit.entity.Villager.Profession.valueOf(
            n.getString("profession", "NONE").toUpperCase(Locale.ROOT));
        org.bukkit.entity.Villager.Type.valueOf(
            n.getString("villager-type", "PLAINS").toUpperCase(Locale.ROOT));
      } catch (Exception x) {
        fail(p + " invalid villager appearance");
      }
      double speed = n.getDouble("speed", 0.15);
      if (!Double.isFinite(speed) || speed <= 0 || speed > 1) fail(p + " speed must be >0 and <=1");
      for (String key : List.of("x", "y", "z", "yaw", "pitch"))
        if (!Double.isFinite(n.getDouble(key))) fail(p + " nonfinite " + key);
      if (n.getDouble("look-radius", 8) < 0 || n.getDouble("look-radius", 8) > 128)
        fail(p + " look-radius 0..128");
      if (n.getInt("interval", 10) < 1) fail(p + " interval must be positive");
      ref(dialogs, n.getString("dialogue"), p);
      ref(shops, n.getString("shop"), p);
      for (Map<?, ?> raw : maps(n, "route")) {
        var w = section(raw);
        coordinates(w, p + " route", true);
        if (w.contains("world") && !w.getString("world", "").equals(n.getString("world")))
          fail(p + " route cannot cross worlds");
      }
    }
    for (var e : dialogs.entrySet()) {
      var d = e.getValue();
      var nodes = sections(d, "nodes");
      requiredRef(nodes, d.getString("start", "start"), "dialogue " + e.getKey());
      for (var node : nodes.entrySet())
        for (Map<?, ?> raw : maps(node.getValue(), "choices")) {
          var c = section(raw);
          if (c.getString("text", "").isBlank()) fail("Choice requires text");
          ref(nodes, c.getString("next"), "choice");
          validateConditions(c);
          validateActions(maps(c, "actions"));
        }
    }
    for (var e : quests.entrySet()) {
      var q = e.getValue();
      number(q, "max-completions", 0, Integer.MAX_VALUE, true);
      number(q, "cooldown-seconds", 0, 315360000, true);
      for (String id : q.getStringList("requires")) ref(quests, id, "quest dependency");
      if (q.getInt("max-completions", 1) < 0 || q.getLong("cooldown-seconds", 0) < 0)
        fail("Negative quest limit");
      if (maps(q, "stages").isEmpty()) fail("Quest " + e.getKey() + " needs stages");
      for (Map<?, ?> raw : maps(q, "stages")) {
        var s = section(raw);
        number(s, "amount", 1, 100000, true);
        if (s.contains("radius")) {
          number(s, "radius", 0.1, 100000, false);
          coordinates(s, "stage region", true);
          if (s.getString("world", "").isBlank()) fail("Stage region requires world");
        }
        String type = s.getString("type", "").toUpperCase(Locale.ROOT);
        if (!Set.of("TALK", "COLLECT", "DELIVER", "VISIT", "BREAK", "KILL", "EVENT").contains(type))
          fail("Invalid quest stage " + type);
        if (s.getInt("amount", 1) < 1 || s.getInt("amount", 1) > 100000)
          fail("Invalid stage amount");
        if (Set.of("COLLECT", "DELIVER", "BREAK").contains(type)) {
          if (type.equals("BREAK")) {
            Material block = Material.matchMaterial(s.getString("material", ""));
            if (block == null || !block.isBlock()) fail("Invalid block");
          } else material(s.getString("material"));
        }
        if (Set.of("TALK", "DELIVER").contains(type))
          requiredRef(npcs, s.getString("npc", ""), "stage NPC");
        if (type.equals("VISIT")) {
          coordinates(s, "VISIT", true);
          if (s.getString("world", "").isBlank()
              || !Double.isFinite(s.getDouble("radius", 3))
              || s.getDouble("radius", 3) <= 0) fail("Invalid visit location");
        }
        if (type.equals("KILL"))
          try {
            EntityType.valueOf(s.getString("entity", "").toUpperCase(Locale.ROOT));
          } catch (Exception ex) {
            fail("Invalid kill entity");
          }
        if (type.equals("EVENT") && s.getString("event", "").isBlank())
          fail("EVENT requires event");
      }
      validateActions(maps(q, "rewards"));
      double totalMoney = 0;
      for (Map<?, ?> raw : maps(q, "rewards")) {
        var reward = section(raw);
        if (reward.getString("type", "").equals("money")) totalMoney += reward.getDouble("amount");
      }
      if (!Double.isFinite(totalMoney)
          || (yaml.getString("economy", "emerald").equals("emerald") && totalMoney > 2304))
        fail("Invalid aggregate currency reward in " + e.getKey());
      for (Map<?, ?> raw : maps(q, "rewards"))
        if (Set.of("quest", "complete").contains(section(raw).getString("type", "")))
          fail("Quest rewards cannot recursively accept or claim quests");
    }
    for (String id : quests.keySet()) cycle(id, new HashSet<>(), new HashSet<>());
    for (var shop : shops.values())
      for (Map<?, ?> raw : maps(shop, "goods")) {
        var g = section(raw);
        number(g, "amount", 1, 2304, true);
        number(g, "buy", -1, Double.MAX_VALUE, false);
        number(g, "sell", -1, Double.MAX_VALUE, false);
        if (yaml.getString("economy", "emerald").equals("emerald")) {
          number(g, "buy", -1, 2304, true);
          number(g, "sell", -1, 2304, true);
        }
        material(g.getString("material"));
        if (g.getInt("amount", 1) < 1 || g.getInt("amount", 1) > 2304)
          fail("Shop quantity 1..2304");
        if (!Double.isFinite(g.getDouble("buy", -1)) || !Double.isFinite(g.getDouble("sell", -1)))
          fail("Invalid price");
      }
  }

  private void cycle(String id, Set<String> stack, Set<String> done) {
    if (done.contains(id)) return;
    if (!stack.add(id)) fail("Quest dependency cycle at " + id);
    for (String dep : quests.get(id).getStringList("requires")) cycle(dep, stack, done);
    stack.remove(id);
    done.add(id);
  }

  private void validateConditions(ConfigurationSection c) {
    for (Map<?, ?> raw : maps(c, "conditions")) {
      var s = section(raw);
      String type = s.getString("type", "");
      if (!Set.of("permission", "variable", "completed", "active", "item").contains(type))
        fail("Unknown condition " + type);
      if (Set.of("completed", "active").contains(type))
        requiredRef(quests, s.getString("quest", ""), "condition");
      if (type.equals("item")) {
        material(s.getString("material"));
        if (s.getInt("amount", 1) < 1) fail("Invalid item condition amount");
      }
      if (type.equals("variable")) key(s.getString("key"), "variable condition");
      if (type.equals("permission") && s.getString("permission", "").isBlank())
        fail("Permission condition requires permission");
    }
  }

  private void validateActions(List<Map<?, ?>> list) {
    for (Map<?, ?> raw : list) {
      var a = section(raw);
      String type = a.getString("type", "");
      if (type.equals("item")) number(a, "amount", 1, 2304, true);
      if (type.equals("money")) number(a, "amount", 0, Double.MAX_VALUE, false);
      if (type.equals("money") && yaml.getString("economy", "emerald").equals("emerald"))
        number(a, "amount", 0, 2304, true);
      if (!Set.of(
              "quest",
              "complete",
              "variable",
              "message",
              "item",
              "money",
              "block",
              "event",
              "command")
          .contains(type)) fail("Unknown action " + type);
      if (Set.of("quest", "complete").contains(type))
        requiredRef(quests, a.getString("quest", ""), "action");
      if (type.equals("variable")) key(a.getString("key"), "variable action");
      if (type.equals("command") && a.getString("command", "").isBlank())
        fail("Empty command action");
      if (type.equals("event") && a.getString("event", "").isBlank()) fail("Empty event action");
      if (type.equals("block")) coordinates(a, "block action", true);
      if (type.equals("item")) {
        material(a.getString("material"));
        if (a.getInt("amount", 1) < 1 || a.getInt("amount", 1) > 2304) fail("Invalid item amount");
      }
      if (type.equals("money")
          && (!Double.isFinite(a.getDouble("amount")) || a.getDouble("amount") < 0))
        fail("Invalid money reward");
      if (type.equals("block")
          && (a.getString("world", "").isBlank()
              || Material.matchMaterial(a.getString("material", "")) == null
              || !Material.matchMaterial(a.getString("material", "")).isBlock()))
        fail("Invalid block action");
    }
  }

  public Location location(ConfigurationSection n) {
    World w = Bukkit.getWorld(n.getString("world", ""));
    return w == null
        ? null
        : new Location(
            w,
            n.getDouble("x"),
            n.getDouble("y"),
            n.getDouble("z"),
            (float) n.getDouble("yaw"),
            (float) n.getDouble("pitch"));
  }
}
