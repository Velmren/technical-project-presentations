package dev.velmren.npc;

import java.lang.reflect.*;
import java.util.*;
import org.bukkit.*;
import org.bukkit.entity.*;
import org.bukkit.plugin.*;

/** No optional dependency is linked by the JVM until its plugin is present. */
public final class Integrations {
  private final MinecraftNpcPlugin plugin;
  private Object economy;
  private Class<?> economyType;
  private boolean papi, wg, citizens;
  private Object expansion;

  public Integrations(MinecraftNpcPlugin p) {
    plugin = p;
    probe();
  }

  private boolean present(String name) {
    Plugin p = Bukkit.getPluginManager().getPlugin(name);
    if (p != null && p.isEnabled()) {
      plugin.getLogger().info(name + " detected: " + p.getDescription().getVersion());
      return true;
    }
    return false;
  }

  public void probe() {
    economy = null;
    economyType = null;
    if (present("Vault"))
      try {
        economyType = Class.forName("net.milkbowl.vault.economy.Economy");
        var registration = Bukkit.getServicesManager().getRegistration(economyType);
        if (registration != null) economy = registration.getProvider();
        else
          plugin.getLogger().warning("Vault has no Economy service; vault transactions disabled");
      } catch (Exception | LinkageError e) {
        warn("Vault", e);
      }
    papi = present("PlaceholderAPI");
    if (!papi && expansion != null) close();
    wg = present("WorldGuard");
    citizens = present("Citizens");
    if (papi && expansion == null)
      try {
        Object candidate =
            Class.forName("dev.velmren.npc.NpcExpansion")
                .getConstructor(MinecraftNpcPlugin.class)
                .newInstance(plugin);
        if (!(boolean) candidate.getClass().getMethod("register").invoke(candidate))
          throw new IllegalStateException("Expansion registration rejected");
        expansion = candidate;
      } catch (Exception | LinkageError e) {
        papi = false;
        warn("PlaceholderAPI registration", e);
      }
    if (citizens)
      try {
        Class.forName("net.citizensnpcs.api.CitizensAPI").getMethod("getNPCRegistry").invoke(null);
      } catch (Exception | LinkageError e) {
        citizens = false;
        warn("Citizens", e);
      }
  }

  public void close() {
    if (expansion != null)
      try {
        expansion.getClass().getMethod("unregister").invoke(expansion);
      } catch (Exception e) {
        warn("PlaceholderAPI unregister", e);
      }
    expansion = null;
  }

  public String diagnostics() {
    return "Vault economy="
        + (economy != null)
        + ", PlaceholderAPI="
        + papi
        + " (expansion="
        + (expansion != null)
        + "), WorldGuard="
        + wg
        + ", Citizens="
        + citizens;
  }

  private void warn(String adapter, Throwable e) {
    plugin
        .getLogger()
        .warning(
            adapter + " adapter failed: " + e.getClass().getSimpleName() + ": " + e.getMessage());
  }

  public String placeholders(Player p, String text) {
    if (papi)
      try {
        return (String)
            Class.forName("me.clip.placeholderapi.PlaceholderAPI")
                .getMethod("setPlaceholders", OfflinePlayer.class, String.class)
                .invoke(null, p, text);
      } catch (Exception | LinkageError e) {
        papi = false;
        warn("PlaceholderAPI", e);
      }
    return text;
  }

  public boolean allowed(Player p, Location l) {
    if (!wg) return true;
    try {
      Object guard =
          Class.forName("com.sk89q.worldguard.WorldGuard").getMethod("getInstance").invoke(null);
      Object platform = call(guard, "getPlatform");
      Object container = call(platform, "getRegionContainer");
      Object query = call(container, "createQuery");
      Object loc =
          Class.forName("com.sk89q.worldedit.bukkit.BukkitAdapter")
              .getMethod("adapt", Location.class)
              .invoke(null, l);
      Object wgPlugin =
          Class.forName("com.sk89q.worldguard.bukkit.WorldGuardPlugin")
              .getMethod("inst")
              .invoke(null);
      Object player = wgPlugin.getClass().getMethod("wrapPlayer", Player.class).invoke(wgPlugin, p);
      Class<?> localPlayer = Class.forName("com.sk89q.worldguard.LocalPlayer");
      Object world =
          Class.forName("com.sk89q.worldedit.bukkit.BukkitAdapter")
              .getMethod("adapt", World.class)
              .invoke(null, l.getWorld());
      Object sessions = call(platform, "getSessionManager");
      if ((boolean)
          Class.forName("com.sk89q.worldguard.session.SessionManager")
              .getMethod("hasBypass", localPlayer, Class.forName("com.sk89q.worldedit.world.World"))
              .invoke(sessions, player, world)) return true;
      Class<?> state = Class.forName("com.sk89q.worldguard.protection.flags.StateFlag");
      Object flags = Array.newInstance(state, 1);
      Array.set(
          flags,
          0,
          Class.forName("com.sk89q.worldguard.protection.flags.Flags")
              .getField("INTERACT")
              .get(null));
      Method test =
          query
              .getClass()
              .getMethod(
                  "testBuild",
                  Class.forName("com.sk89q.worldedit.util.Location"),
                  localPlayer,
                  flags.getClass());
      return (boolean) test.invoke(query, loc, player, flags);
    } catch (Exception | LinkageError e) {
      warn("WorldGuard (interaction denied)", e);
      return false;
    }
  }

  public boolean money(Player p, double amount, boolean withdraw) {
    refreshEconomy();
    if (economy == null || economyType == null) return false;
    try {
      Object result =
          economyType
              .getMethod(
                  withdraw ? "withdrawPlayer" : "depositPlayer", OfflinePlayer.class, double.class)
              .invoke(economy, p, amount);
      boolean ok = (boolean) result.getClass().getMethod("transactionSuccess").invoke(result);
      if (!ok)
        plugin
            .getLogger()
            .warning(
                "Economy rejected "
                    + (withdraw ? "withdrawal" : "deposit")
                    + " for "
                    + p.getUniqueId());
      return ok;
    } catch (Exception | LinkageError e) {
      warn("Vault", e);
      return false;
    }
  }

  public boolean has(Player p, double amount) {
    refreshEconomy();
    if (economy == null) return false;
    try {
      return (boolean)
          economyType
              .getMethod("has", OfflinePlayer.class, double.class)
              .invoke(economy, p, amount);
    } catch (Exception e) {
      warn("Vault", e);
      return false;
    }
  }

  private void refreshEconomy() {
    if (economyType == null) return;
    var registration = Bukkit.getServicesManager().getRegistration(economyType);
    economy = registration == null ? null : registration.getProvider();
  }

  public Object spawnCitizen(
      String id, String name, org.bukkit.entity.EntityType type, Location loc, String skin)
      throws Exception {
    if (!citizens)
      throw new IllegalStateException(
          "Citizens backend requested but compatible Citizens is unavailable");
    Object registry =
        Class.forName("net.citizensnpcs.api.CitizensAPI").getMethod("getNPCRegistry").invoke(null);
    Object npc =
        registry
            .getClass()
            .getMethod("createNPC", org.bukkit.entity.EntityType.class, String.class)
            .invoke(registry, type, name);
    call(
        call(npc, "data"),
        "setPersistent",
        new Class[] {String.class, Object.class},
        "minecraft-npc-system",
        id);
    call(npc, "setProtected", new Class[] {boolean.class}, true);
    if (!skin.isBlank())
      try {
        Class<?> trait = Class.forName("net.citizensnpcs.trait.SkinTrait");
        Object t = call(npc, "getOrAddTrait", new Class[] {Class.class}, trait);
        call(t, "setSkinName", new Class[] {String.class}, skin);
      } catch (Exception e) {
        call(npc, "destroy");
        throw new IllegalStateException("Citizens skin API incompatible", e);
      }
    if (!(boolean) call(npc, "spawn", new Class[] {Location.class}, loc)) {
      call(npc, "destroy");
      throw new IllegalStateException("Citizens refused NPC spawn");
    }
    return npc;
  }

  public void cleanupCitizens() {
    if (!citizens) return;
    try {
      Object reg =
          Class.forName("net.citizensnpcs.api.CitizensAPI")
              .getMethod("getNPCRegistry")
              .invoke(null);
      List<Object> destroy = new ArrayList<>();
      for (Object n : (Iterable<?>) reg) {
        Object data = call(n, "data");
        if ((boolean) call(data, "has", new Class[] {String.class}, "minecraft-npc-system"))
          destroy.add(n);
      }
      for (Object n : destroy) call(n, "destroy");
    } catch (Exception e) {
      warn("Citizens cleanup", e);
    }
  }

  public Entity citizenEntity(Object npc) throws Exception {
    return (Entity) call(npc, "getEntity");
  }

  public void navigate(Object npc, Location l) throws Exception {
    call(call(npc, "getNavigator"), "setTarget", new Class[] {Location.class}, l);
  }

  public void destroyCitizen(Object npc) {
    try {
      call(npc, "destroy");
    } catch (Exception e) {
      warn("Citizens destroy", e);
    }
  }

  private static Object call(Object o, String name) throws Exception {
    return o.getClass().getMethod(name).invoke(o);
  }

  private static Object call(Object o, String name, Class<?>[] types, Object... args)
      throws Exception {
    return o.getClass().getMethod(name, types).invoke(o, args);
  }
}
