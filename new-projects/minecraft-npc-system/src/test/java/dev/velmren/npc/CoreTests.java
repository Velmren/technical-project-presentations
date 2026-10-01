package dev.velmren.npc;

import java.lang.reflect.Proxy;
import java.nio.file.*;
import java.util.*;
import org.bukkit.*;
import org.bukkit.inventory.*;

/** Real YAML, disk failure and inventory algorithms. No server gameplay claims. */
public final class CoreTests {
  private static int assertions;

  private static void check(boolean condition, String message) {
    assertions++;
    if (!condition) throw new AssertionError(message);
  }

  private static void rejected(String yaml, String message) throws Exception {
    try {
      Definitions.parse(yaml);
      throw new AssertionError("Accepted " + message);
    } catch (IllegalArgumentException expected) {
      assertions++;
    }
  }

  public static void main(String[] args) throws Exception {
    org.bukkit.inventory.ItemFactory factory =
        (org.bukkit.inventory.ItemFactory)
            Proxy.newProxyInstance(
                CoreTests.class.getClassLoader(),
                new Class[] {org.bukkit.inventory.ItemFactory.class},
                (o, m, a) -> {
                  if (m.getName().equals("equals")) return Objects.equals(a[0], a[1]);
                  return null;
                });
    Server server =
        (Server)
            Proxy.newProxyInstance(
                CoreTests.class.getClassLoader(),
                new Class[] {Server.class},
                (o, m, a) ->
                    switch (m.getName()) {
                      case "getItemFactory" -> factory;
                      case "getLogger" -> java.util.logging.Logger.getLogger("CoreTests");
                      case "getName", "getVersion", "getBukkitVersion" -> "CoreTests";
                      default -> null;
                    });
    Bukkit.setServer(server);
    Definitions d = Definitions.load(new java.io.File("src/main/resources/config.yml"));
    check(d.npcs.size() == 8, "Eight NPC definitions");
    check(d.quests.size() == 8, "Eight quests");
    check(d.dialogs.size() == 8, "Eight dialogues");
    String npc = "npcs:\n  test:\n    world: demo\n    x: 0\n    y: 65\n    z: 0\n";
    rejected(npc + "    profession: NO_SUCH_PROFESSION\n", "bad appearance");
    rejected(npc + "quests:\n  q:\n    stages: [{type: TALK}]\n", "missing TALK target");
    rejected(
        npc
            + "dialogs:\n"
            + "  d:\n"
            + "    nodes:\n"
            + "      start:\n"
            + "        choices: [{text: bad, next: absent}]\n",
        "missing graph link");
    rejected(
        npc
            + "quests:\n"
            + "  a:\n"
            + "    requires: [b]\n"
            + "    stages: [{type: TALK, npc: test}]\n"
            + "  b:\n"
            + "    requires: [a]\n"
            + "    stages: [{type: TALK, npc: test}]\n",
        "dependency cycle");
    rejected(npc.replace("x: 0", "x: wrong"), "invalid coordinate type");
    rejected(
        npc + "shops:\n  s:\n    goods: [{material: STONE, amount: -1, buy: 1}]\n",
        "negative item amount");
    rejected(
        npc
            + "dialogs:\n"
            + "  d:\n"
            + "    nodes:\n"
            + "      start:\n"
            + "        choices: [{text: bad, actions: [{type: quest}]}]\n",
        "missing quest target");
    rejected(
        npc + "shops:\n  s:\n    goods: [{material: BREAD, buy: 1.5}]\n",
        "fractional emerald price");
    rejected(
        npc + "shops:\n  s:\n    goods: [{material: BREAD, buy: 3000}]\n",
        "oversized emerald price");
    rejected(
        npc
            + "quests:\n"
            + "  q:\n"
            + "    stages: [{type: TALK, npc: test}]\n"
            + "    rewards: [{type: money, amount: 2000}, {type: money, amount: 2000}]\n",
        "oversized aggregate currency");
    rejected(
        npc
            + "quests:\n"
            + "  q:\n"
            + "    stages: [{type: TALK, npc: test}]\n"
            + "    rewards: [{type: block, world: demo, x: 0, y: 65, z: 0, material: STICK}]\n",
        "nonblock reward");
    rejected(npc + "    route: [{world: another, x: 0, y: 65, z: 0}]\n", "crossworld native route");
    rejected(
        npc + "quests:\n  q:\n    stages: [{type: TALK, npc: test}, invalid]\n",
        "mixed malformed list");
    Path configDir = Files.createTempDirectory("npc-config-tests");
    Path configFile = configDir.resolve("config.yml");
    Files.writeString(configFile, "economy: emerald\n");
    try {
      Definitions.load(configFile.toFile());
      throw new AssertionError("Missing split file accepted");
    } catch (IllegalArgumentException expected) {
      assertions++;
    }
    Files.writeString(configFile, "npcs: {}\ndialogs: {}\nquests: {}\nshops: {}\n");
    check(
        Definitions.load(configFile.toFile()).npcs.isEmpty(),
        "Explicit monolithic sections accepted");
    Path dir = Files.createTempDirectory("npc-core-tests");
    Path file = dir.resolve("progress.yml");
    UUID a = UUID.randomUUID(), b = UUID.randomUUID();
    ProgressStore store = new ProgressStore(file);
    store.set(a, "quests.welcome.stage", 2);
    store.set(b, "quests.welcome.stage", 1);
    ProgressStore reopened = new ProgressStore(file);
    check(reopened.integer(a, "quests.welcome.stage") == 2, "UUID A survives reopen");
    check(reopened.integer(b, "quests.welcome.stage") == 1, "UUID B isolated");
    Files.move(file, dir.resolve("backup.yml"));
    Files.createDirectory(file);
    Files.writeString(file.resolve("sentinel"), "block rename");
    try {
      store.set(a, "quests.welcome.stage", 9);
      throw new AssertionError("Write failure not propagated");
    } catch (java.io.IOException expected) {
      assertions++;
    }
    check(store.integer(a, "quests.welcome.stage") == 2, "Failed disk write restores memory");
    Files.delete(file.resolve("sentinel"));
    Files.delete(file);
    Files.move(dir.resolve("backup.yml"), file);
    Files.writeString(file, "players: [broken");
    try {
      new ProgressStore(file);
      throw new AssertionError("Corrupt state silently reset");
    } catch (org.bukkit.configuration.InvalidConfigurationException expected) {
      assertions++;
    }
    Files.writeString(file, "players: []\n");
    try {
      new ProgressStore(file);
      throw new AssertionError("Invalid progress schema accepted");
    } catch (IllegalArgumentException expected) {
      assertions++;
    }
    ItemStack[][] slots = {new ItemStack[36]};
    PlayerInventory inv =
        (PlayerInventory)
            Proxy.newProxyInstance(
                CoreTests.class.getClassLoader(),
                new Class[] {PlayerInventory.class},
                (o, m, x) -> {
                  if (m.getName().equals("getStorageContents")) return slots[0];
                  if (m.getName().equals("setStorageContents")) {
                    slots[0] = (ItemStack[]) x[0];
                    return null;
                  }
                  return null;
                });
    for (int i = 0; i < 36; i++) slots[0][i] = new ItemStack(Material.STONE, 64);
    check(
        !InventoryOps.fits(inv, List.of(new ItemStack(Material.BREAD, 1))),
        "Full inventory rejected");
    slots[0][0] = new ItemStack(Material.BREAD, 63);
    check(
        InventoryOps.fits(inv, List.of(new ItemStack(Material.BREAD, 1))),
        "Existing stack room accepted");
    check(!InventoryOps.fits(inv, List.of(new ItemStack(Material.BREAD, 2))), "Overflow rejected");
    check(slots[0][0].getAmount() == 63, "Preflight does not mutate inventory");
    slots[0][1] = null;
    check(
        !InventoryOps.fits(
            inv,
            List.of(new ItemStack(Material.BREAD, 64), new ItemStack(Material.IRON_INGOT, 64))),
        "Aggregate reward capacity checked");
    check(InventoryOps.count(inv, Material.STONE) == 34 * 64, "Storage material count");
    check(
        !InventoryOps.remove(inv, Material.STONE, 34 * 64 + 1),
        "Insufficient removal leaves inventory");
    check(InventoryOps.remove(inv, Material.STONE, 65), "Removal spans slots");
    check(InventoryOps.count(inv, Material.STONE) == 34 * 64 - 65, "Exact quantity removed");
    System.out.println(
        "CoreTests passed: "
            + assertions
            + " assertions (YAML, UUID disk state, failure rollback, inventory preflight)");
  }
}
