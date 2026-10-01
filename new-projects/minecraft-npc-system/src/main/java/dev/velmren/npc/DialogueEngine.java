package dev.velmren.npc;

import java.security.SecureRandom;
import java.util.*;
import net.md_5.bungee.api.chat.ClickEvent;
import net.md_5.bungee.api.chat.HoverEvent;
import net.md_5.bungee.api.chat.TextComponent;
import org.bukkit.*;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.entity.Player;
import org.bukkit.inventory.*;

public final class DialogueEngine {
  public static final class Menu implements InventoryHolder {
    public final UUID player;
    public final String token;

    Menu(UUID p, String t) {
      player = p;
      token = t;
    }

    public Inventory getInventory() {
      return null;
    }
  }

  private record Option(ConfigurationSection choice, String shop, int index, boolean buy) {}

  private record Session(
      String npc, String dialog, String node, String token, long expires, List<Option> options) {}

  private final MinecraftNpcPlugin plugin;
  private final Map<UUID, Session> sessions = new HashMap<>();
  private final SecureRandom random = new SecureRandom();

  public DialogueEngine(MinecraftNpcPlugin p) {
    plugin = p;
  }

  public void clear() {
    sessions.clear();
  }

  public void leave(Player p) {
    sessions.remove(p.getUniqueId());
  }

  public void open(Player p, String npc) {
    var n = plugin.definitions.npcs.get(npc);
    if (n == null) return;
    String dialog = n.getString("dialogue", "");
    if (!dialog.isEmpty())
      render(p, npc, dialog, plugin.definitions.dialogs.get(dialog).getString("start", "start"));
    else if (!n.getString("shop", "").isEmpty()) shop(p, npc, n.getString("shop"));
  }

  private String token() {
    byte[] b = new byte[12];
    random.nextBytes(b);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
  }

  private boolean access(Player p, String npc) {
    var n = plugin.definitions.npcs.get(npc);
    var e = plugin.npcs.entity(npc);
    if (n == null
        || e == null
        || !e.isValid()
        || !n.getBoolean("enabled", true)
        || !p.hasPermission("npcs.use")
        || p.getWorld() != e.getWorld()
        || p.getLocation().distanceSquared(e.getLocation())
            > Math.pow(plugin.definitions.yaml.getDouble("interaction-distance", 6), 2))
      return false;
    String permission = n.getString("permission", "");
    return (permission.isBlank() || p.hasPermission(permission))
        && plugin.integrations.allowed(p, e.getLocation());
  }

  public void choose(Player p, String token, int index) {
    Session s = sessions.get(p.getUniqueId());
    if (s == null
        || !s.token.equals(token)
        || s.expires < System.currentTimeMillis()
        || !access(p, s.npc)
        || index < 0
        || index >= s.options.size()) {
      plugin.tell(p, "Dialogue expired or choice unavailable. Speak to the NPC again.");
      return;
    }
    sessions.remove(p.getUniqueId());
    p.closeInventory();
    Option o = s.options.get(index);
    if (o.shop != null) {
      plugin.shops.trade(p, o.shop, o.index, o.buy);
      shop(p, s.npc, o.shop);
      return;
    }
    if (!conditions(p, o.choice)) {
      plugin.tell(p, "Choice requirements changed.");
      render(p, s.npc, s.dialog, s.node);
      return;
    }
    for (Map<?, ?> raw : o.choice.getMapList("actions"))
      if (!action(p, Definitions.section(raw))) return;
    String next = o.choice.getString("next", "");
    if (!next.isEmpty()) render(p, s.npc, s.dialog, next);
    else if (o.choice.getBoolean("open-shop", false)) {
      var n = plugin.definitions.npcs.get(s.npc);
      if (n.contains("shop")) shop(p, s.npc, n.getString("shop"));
    }
  }

  private void render(Player p, String npc, String dialog, String node) {
    if (!access(p, npc)) return;
    var graph = plugin.definitions.dialogs.get(dialog);
    var n = graph.getConfigurationSection("nodes." + node);
    if (n == null) return;
    List<Option> options = new ArrayList<>();
    for (Map<?, ?> raw : n.getMapList("choices")) {
      var c = Definitions.section(raw);
      if (conditions(p, c)) options.add(new Option(c, null, 0, false));
    }
    String text = n.getString("text", "");
    plugin.tell(p, format(p, text));
    display(
        p,
        new Session(
            npc,
            dialog,
            node,
            token(),
            System.currentTimeMillis()
                + plugin.definitions.yaml.getLong("session-seconds", 90) * 1000,
            List.copyOf(options)),
        plugin.definitions.npcs.get(npc).getString("name", npc));
  }

  public void shop(Player p, String npc, String shop) {
    if (!access(p, npc) || !plugin.definitions.shops.containsKey(shop)) return;
    List<Option> opts = new ArrayList<>();
    var goods = plugin.definitions.shops.get(shop).getMapList("goods");
    for (int i = 0; i < goods.size(); i++) {
      var g = Definitions.section(goods.get(i));
      for (boolean buy : List.of(true, false)) {
        double price = g.getDouble(buy ? "buy" : "sell", -1);
        if (price < 0) continue;
        var label = new org.bukkit.configuration.file.YamlConfiguration();
        label.set(
            "text",
            (buy ? "Buy " : "Sell ")
                + g.getInt("amount", 1)
                + " "
                + g.getString("material")
                + " — "
                + price
                + " "
                + plugin.definitions.yaml.getString("economy", "emerald"));
        label.set("material", g.getString("material"));
        opts.add(new Option(label, shop, i, buy));
      }
    }
    display(
        p,
        new Session(
            npc,
            "",
            "",
            token(),
            System.currentTimeMillis()
                + plugin.definitions.yaml.getLong("session-seconds", 90) * 1000,
            List.copyOf(opts)),
        "Shop: " + shop);
  }

  private void display(Player p, Session s, String title) {
    sessions.put(p.getUniqueId(), s);
    int size = Math.max(9, Math.min(54, ((s.options.size() + 8) / 9) * 9));
    String heading = MinecraftNpcPlugin.color(title);
    if (heading.length() > 32) heading = heading.substring(0, 32);
    Inventory menu = Bukkit.createInventory(new Menu(p.getUniqueId(), s.token), size, heading);
    for (int i = 0; i < s.options.size(); i++) {
      Option o = s.options.get(i);
      String text = format(p, o.choice.getString("text", "Choice"));
      TextComponent choice =
          new TextComponent(
              TextComponent.fromLegacyText(
                  MinecraftNpcPlugin.color("&6[NPC] &f[" + (i + 1) + "] " + text)));
      choice.setClickEvent(
          new ClickEvent(ClickEvent.Action.RUN_COMMAND, "/npcs choose " + s.token + " " + i));
      choice.setHoverEvent(
          new HoverEvent(
              HoverEvent.Action.SHOW_TEXT, TextComponent.fromLegacyText("Выбрать ответ")));
      p.spigot().sendMessage(choice);
      if (i < size) {
        Material m = Material.matchMaterial(o.choice.getString("material", "PAPER"));
        if (m == null || !m.isItem()) m = Material.PAPER;
        ItemStack item = new ItemStack(m);
        var meta = item.getItemMeta();
        meta.setDisplayName(MinecraftNpcPlugin.color(text));
        meta.setLore(
            List.of(
                ChatColor.GRAY + "Нажмите, чтобы выбрать",
                ChatColor.DARK_GRAY + "Ответ " + (i + 1)));
        item.setItemMeta(meta);
        menu.setItem(i, item);
      }
    }
    p.openInventory(menu);
  }

  public boolean conditions(Player p, ConfigurationSection choice) {
    for (Map<?, ?> raw : choice.getMapList("conditions")) {
      var c = Definitions.section(raw);
      boolean pass =
          switch (c.getString("type", "")) {
            case "permission" -> p.hasPermission(c.getString("permission", ""));
            case "completed" -> plugin.quests.completed(p, c.getString("quest"));
            case "active" -> plugin.quests.active(p, c.getString("quest"));
            case "variable" ->
                Objects.equals(
                    String.valueOf(
                        plugin.progress.value(p.getUniqueId(), "variables." + c.getString("key"))),
                    String.valueOf(c.get("value")));
            case "item" ->
                InventoryOps.count(p.getInventory(), Definitions.material(c.getString("material")))
                    >= c.getInt("amount", 1);
            default -> false;
          };
      if (c.getBoolean("not", false)) pass = !pass;
      if (!pass) return false;
    }
    return true;
  }

  public String format(Player p, String text) {
    String out = text.replace("{player}", p.getName());
    for (String id : plugin.definitions.quests.keySet()) {
      out =
          out.replace("{quest:" + id + ":stage}", String.valueOf(plugin.quests.stage(p, id)))
              .replace(
                  "{quest:" + id + ":completed}", String.valueOf(plugin.quests.completed(p, id)));
    }
    java.util.regex.Matcher m =
        java.util.regex.Pattern.compile("\\{var:([a-zA-Z0-9_-]+)}").matcher(out);
    StringBuffer b = new StringBuffer();
    while (m.find())
      m.appendReplacement(
          b,
          java.util.regex.Matcher.quoteReplacement(
              plugin.progress.string(p.getUniqueId(), "variables." + m.group(1))));
    m.appendTail(b);
    return plugin.integrations.placeholders(p, b.toString());
  }

  public boolean action(Player p, ConfigurationSection a) {
    try {
      switch (a.getString("type", "")) {
        case "quest" -> {
          return plugin.quests.accept(p, a.getString("quest"));
        }
        case "complete" -> {
          return plugin.quests.claim(p, a.getString("quest"));
        }
        case "variable" ->
            plugin.progress.set(p.getUniqueId(), "variables." + a.getString("key"), a.get("value"));
        case "message" -> plugin.tell(p, format(p, a.getString("text", "")));
        case "item" -> {
          Material m = Definitions.material(a.getString("material"));
          int amount = a.getInt("amount", 1);
          if (!InventoryOps.fits(p.getInventory(), List.of(new ItemStack(m, amount)))) {
            plugin.tell(p, "Make room first.");
            return false;
          }
          InventoryOps.give(p.getInventory(), m, amount);
        }
        case "money" -> {
          double amount = a.getDouble("amount");
          if (plugin.definitions.yaml.getString("economy", "emerald").equals("emerald")) {
            if (amount != Math.floor(amount) || amount > 2304)
              throw new IllegalStateException("Invalid emerald amount");
            if (!InventoryOps.fits(
                p.getInventory(), List.of(new ItemStack(Material.EMERALD, (int) amount))))
              return false;
            InventoryOps.give(p.getInventory(), Material.EMERALD, (int) amount);
          } else if (!plugin.integrations.money(p, amount, false)) return false;
        }
        case "block" -> {
          Location l = plugin.definitions.location(a);
          if (l == null) return false;
          l.getBlock().setType(Material.matchMaterial(a.getString("material")), false);
        }
        case "event" -> plugin.quests.increment(p, "EVENT", a.getString("event"), p.getLocation());
        case "command" -> {
          String command =
              a.getString("command", "")
                  .replace("{player}", p.getName())
                  .replace("{uuid}", p.getUniqueId().toString());
          if (command.isBlank()) return false;
          Bukkit.dispatchCommand(Bukkit.getConsoleSender(), command);
        }
        default -> {
          return false;
        }
      }
      return true;
    } catch (Exception x) {
      plugin.failure(p, x);
      return false;
    }
  }
}
