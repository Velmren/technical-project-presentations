package dev.velmren.npc;

import java.util.*;
import org.bukkit.*;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

public final class ShopEngine {
  private final MinecraftNpcPlugin plugin;
  private final Set<UUID> busy = new HashSet<>();

  public ShopEngine(MinecraftNpcPlugin p) {
    plugin = p;
  }

  public void trade(Player p, String shop, int index, boolean buy) {
    var s = plugin.definitions.shops.get(shop);
    if (s == null
        || index < 0
        || index >= s.getMapList("goods").size()
        || !busy.add(p.getUniqueId())) return;
    try {
      var g = Definitions.section(s.getMapList("goods").get(index));
      double price = g.getDouble(buy ? "buy" : "sell", -1);
      if (price < 0) {
        plugin.tell(p, "This trade is disabled.");
        return;
      }
      String permission = g.getString("permission", s.getString("permission", ""));
      if (!permission.isEmpty() && !p.hasPermission(permission)) {
        plugin.tell(p, "You lack trade permission.");
        return;
      }
      Material material = Definitions.material(g.getString("material"));
      int quantity = g.getInt("amount", 1);
      boolean emerald = plugin.definitions.yaml.getString("economy", "emerald").equals("emerald");
      if (emerald && (price != Math.floor(price) || price > 2304))
        throw new IllegalStateException("Emerald prices must be whole numbers <=2304");
      ItemStack[] before = InventoryOps.copy(p.getInventory());
      boolean charged = false, credited = false;
      try {
        if (buy) {
          if (emerald) {
            if (!InventoryOps.remove(p.getInventory(), Material.EMERALD, (int) price)) {
              plugin.tell(p, "Not enough emeralds.");
              return;
            }
          } else if (!plugin.integrations.has(p, price)) {
            plugin.tell(p, "Insufficient balance or economy unavailable.");
            return;
          }
          if (!InventoryOps.fits(p.getInventory(), List.of(new ItemStack(material, quantity)))) {
            p.getInventory().setStorageContents(before);
            plugin.tell(p, "Not enough inventory space.");
            return;
          }
          if (!emerald && price > 0) {
            if (!plugin.integrations.money(p, price, true))
              throw new IllegalStateException("Withdrawal failed");
            charged = true;
          }
          InventoryOps.give(p.getInventory(), material, quantity);
        } else {
          if (!InventoryOps.remove(p.getInventory(), material, quantity)) {
            plugin.tell(p, "You need " + quantity + " ordinary " + material + ".");
            return;
          }
          if (emerald) {
            if (!InventoryOps.fits(
                p.getInventory(), List.of(new ItemStack(Material.EMERALD, (int) price)))) {
              p.getInventory().setStorageContents(before);
              plugin.tell(p, "Make room for the emeralds.");
              return;
            }
            InventoryOps.give(p.getInventory(), Material.EMERALD, (int) price);
          } else if (price > 0) {
            if (!plugin.integrations.money(p, price, false))
              throw new IllegalStateException("Deposit failed");
            credited = true;
          }
        }
        plugin.tell(
            p,
            (buy ? "Bought " : "Sold ")
                + quantity
                + " "
                + material.name().toLowerCase(Locale.ROOT));
        plugin.quests.poll(p);
      } catch (Exception x) {
        p.getInventory().setStorageContents(before);
        boolean ok = true;
        if (charged) ok = plugin.integrations.money(p, price, false);
        if (credited) ok = plugin.integrations.money(p, price, true);
        if (!ok)
          plugin
              .getLogger()
              .severe(
                  "Shop economy rollback failed for "
                      + p.getUniqueId()
                      + "; manual reconciliation required");
        throw x;
      }
    } catch (Exception x) {
      plugin.failure(p, x);
    } finally {
      busy.remove(p.getUniqueId());
    }
  }
}
