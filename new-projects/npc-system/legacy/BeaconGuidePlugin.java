package dev.velmren.guide;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.bukkit.Material;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.entity.Villager;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerInteractEntityEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.NamespacedKey;
import net.kyori.adventure.text.Component;

public final class BeaconGuidePlugin extends JavaPlugin implements Listener {
    private final Map<UUID, Quest> quests = new HashMap<>();
    private NamespacedKey guideKey;
    @Override public void onEnable() {
        guideKey = new NamespacedKey(this, "beacon-guide");
        getServer().getPluginManager().registerEvents(this, this);
        getLogger().info("Beacon Guide ready: /beacon spawn, talk, accept, offer, claim, reset");
    }
    @EventHandler public void interact(PlayerInteractEntityEvent event) {
        if (!event.getRightClicked().getPersistentDataContainer().has(guideKey, PersistentDataType.BYTE)) return;
        event.setCancelled(true);
        event.getPlayer().sendMessage(Component.text(quests.computeIfAbsent(event.getPlayer().getUniqueId(), id -> new Quest()).talk()));
    }
    @Override public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player player)) { sender.sendMessage("Use in game as a player."); return true; }
        Quest quest = quests.computeIfAbsent(player.getUniqueId(), id -> new Quest());
        String action = args.length == 0 ? "talk" : args[0];
        String message;
        switch (action) {
            case "spawn":
                if (!player.hasPermission("beaconguide.admin")) { message = "Admin permission required."; break; }
                Villager guide = player.getWorld().spawn(player.getLocation(), Villager.class);
                guide.customName(Component.text("Rowan • Beacon Keeper")); guide.setCustomNameVisible(true);
                guide.setAI(false); guide.setInvulnerable(true);
                guide.getPersistentDataContainer().set(guideKey, PersistentDataType.BYTE, (byte) 1);
                message = "Rowan is ready. Right click to talk."; break;
            case "accept": message = quest.accept() ? "Request accepted. Offer three copper ingots, one at a time." : "Request already started."; break;
            case "offer":
                if (quest.state() != Quest.State.COLLECTING) { message = "Accept the request first, or claim your completed reward."; break; }
                if (!player.getInventory().contains(Material.COPPER_INGOT)) { message = "You need a copper ingot."; break; }
                if (quest.collect()) player.getInventory().removeItem(new ItemStack(Material.COPPER_INGOT, 1));
                message = quest.talk(); break;
            case "claim":
                if (player.getInventory().firstEmpty() == -1) { message = "Make room in your inventory first."; break; }
                if (quest.claim()) { player.getInventory().addItem(new ItemStack(Material.EMERALD, 1)); message = "Beacon restored. One emerald awarded."; }
                else message = "Reward is not available.";
                break;
            case "reset":
                if (!player.hasPermission("beaconguide.admin")) { message = "Admin permission required."; break; }
                quest.reset(); message = "Demo quest reset."; break;
            default: message = quest.talk();
        }
        player.sendMessage(Component.text(message)); return true;
    }
}
