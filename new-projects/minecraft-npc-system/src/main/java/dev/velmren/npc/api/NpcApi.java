package dev.velmren.npc.api;

import org.bukkit.entity.Player;

public interface NpcApi {
  boolean acceptQuest(Player player, String quest);

  boolean claimQuest(Player player, String quest);

  void signal(Player player, String event);

  String placeholder(Player player, String identifier);

  boolean isActive(Player player, String quest);

  boolean isCompleted(Player player, String quest);
}
