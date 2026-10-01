package dev.velmren.npc.api;

import org.bukkit.entity.Player;
import org.bukkit.event.*;

public final class NpcInteractEvent extends Event implements Cancellable {
  private static final HandlerList HANDLERS = new HandlerList();
  private final Player player;
  private final String npc;
  private boolean cancelled;

  public NpcInteractEvent(Player p, String n) {
    player = p;
    npc = n;
  }

  public Player getPlayer() {
    return player;
  }

  public String getNpcId() {
    return npc;
  }

  public boolean isCancelled() {
    return cancelled;
  }

  public void setCancelled(boolean c) {
    cancelled = c;
  }

  public HandlerList getHandlers() {
    return HANDLERS;
  }

  public static HandlerList getHandlerList() {
    return HANDLERS;
  }
}
