package dev.velmren.npc;

import java.util.*;
import org.bukkit.Material;
import org.bukkit.inventory.*;

public final class InventoryOps {
  private InventoryOps() {}

  public static int count(PlayerInventory inv, Material m) {
    int n = 0;
    for (ItemStack s : inv.getStorageContents())
      if (s != null && s.getType() == m && !s.hasItemMeta()) n += s.getAmount();
    return n;
  }

  public static boolean remove(PlayerInventory inv, Material m, int amount) {
    if (count(inv, m) < amount) return false;
    ItemStack[] slots = inv.getStorageContents();
    for (int i = 0; i < slots.length && amount > 0; i++) {
      ItemStack s = slots[i];
      if (s == null || s.getType() != m || s.hasItemMeta()) continue;
      int take = Math.min(s.getAmount(), amount);
      amount -= take;
      if (take == s.getAmount()) slots[i] = null;
      else s.setAmount(s.getAmount() - take);
    }
    inv.setStorageContents(slots);
    return true;
  }

  public static ItemStack[] copy(PlayerInventory inv) {
    ItemStack[] a = inv.getStorageContents().clone();
    for (int i = 0; i < a.length; i++) if (a[i] != null) a[i] = a[i].clone();
    return a;
  }

  public static boolean fits(PlayerInventory inv, List<ItemStack> gifts) {
    ItemStack[] a = copy(inv);
    for (ItemStack gift : gifts) {
      int remaining = gift.getAmount();
      for (ItemStack s : a)
        if (s != null && s.isSimilar(gift)) {
          int add = Math.min(remaining, Math.max(0, s.getMaxStackSize() - s.getAmount()));
          s.setAmount(s.getAmount() + add);
          remaining -= add;
        }
      for (int i = 0; i < a.length && remaining > 0; i++)
        if (a[i] == null || a[i].getType() == Material.AIR) {
          a[i] = gift.clone();
          int add = Math.min(remaining, gift.getMaxStackSize());
          a[i].setAmount(add);
          remaining -= add;
        }
      if (remaining > 0) return false;
    }
    return true;
  }

  public static void give(PlayerInventory inv, Material m, int amount) {
    while (amount > 0) {
      int n = Math.min(amount, m.getMaxStackSize());
      if (!inv.addItem(new ItemStack(m, n)).isEmpty())
        throw new IllegalStateException("Inventory changed during award");
      amount -= n;
    }
  }
}
