package dev.velmren.npc;

import me.clip.placeholderapi.expansion.PlaceholderExpansion;
import org.bukkit.OfflinePlayer;

/** Loaded only after PlaceholderAPI is detected; no hard plugin dependency. */
public final class NpcExpansion extends PlaceholderExpansion {
  private final MinecraftNpcPlugin plugin;

  public NpcExpansion(MinecraftNpcPlugin plugin) {
    this.plugin = plugin;
  }

  public String getIdentifier() {
    return "npcs";
  }

  public String getAuthor() {
    return "Velmren";
  }

  public String getVersion() {
    return plugin.getDescription().getVersion();
  }

  public boolean persist() {
    return true;
  }

  @Override
  public String onRequest(OfflinePlayer player, String id) {
    if (player == null) return "";
    java.util.UUID u = player.getUniqueId();
    if (id.startsWith("variable_"))
      return plugin.progress.string(u, "variables." + id.substring(9));
    if (id.startsWith("stage_"))
      return String.valueOf(plugin.progress.integer(u, "quests." + id.substring(6) + ".stage"));
    if (id.startsWith("completed_"))
      return String.valueOf(
          plugin.progress.integer(u, "quests." + id.substring(10) + ".completions") > 0);
    if (id.startsWith("active_"))
      return String.valueOf(plugin.progress.flag(u, "quests." + id.substring(7) + ".active"));
    return null;
  }
}
