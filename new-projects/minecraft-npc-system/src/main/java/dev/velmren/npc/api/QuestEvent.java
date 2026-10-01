package dev.velmren.npc.api;

import org.bukkit.entity.Player;
import org.bukkit.event.*;

/** Fired synchronously after durable quest state commits. */
public final class QuestEvent extends Event {
  public enum Kind {
    ACCEPTED,
    STAGE,
    COMPLETED
  }

  private static final HandlerList HANDLERS = new HandlerList();
  private final Player player;
  private final String quest;
  private final Kind kind;
  private final int stage;

  public QuestEvent(Player p, String q, Kind k, int s) {
    player = p;
    quest = q;
    kind = k;
    stage = s;
  }

  public Player getPlayer() {
    return player;
  }

  public String getQuest() {
    return quest;
  }

  public Kind getKind() {
    return kind;
  }

  public int getStage() {
    return stage;
  }

  @Override
  public HandlerList getHandlers() {
    return HANDLERS;
  }

  public static HandlerList getHandlerList() {
    return HANDLERS;
  }
}
