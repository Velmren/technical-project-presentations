package dev.velmren.guide;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import org.bukkit.*;
import org.bukkit.entity.*;
import org.bukkit.event.player.PlayerInteractEntityEvent;
import org.bukkit.inventory.*;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.java.JavaPlugin;
import net.kyori.adventure.text.Component;

/** Test-only plugin: actual Paper world/entities/event bus, controlled Player proxy. */
public final class PaperVerifier extends JavaPlugin {
 private int checks;
 private void check(boolean ok,String name){checks++;if(!ok)throw new AssertionError(name);}
 @Override public void onEnable(){
  getServer().getScheduler().runTaskLater(this,()->{
   try{verify();}catch(Throwable e){e.printStackTrace();getLogger().severe("HARBOR_VERIFY_FAIL "+e);}
  },60);
 }
 private void verify()throws Exception{
  JavaPlugin plugin=(JavaPlugin)getServer().getPluginManager().getPlugin("NorthHarbor");
  check(plugin!=null&&plugin.isEnabled(),"plugin enabled");
  int phase=Integer.parseInt(System.getProperty("harbor.verify.phase","1"));
  UUID id=UUID.fromString("3817551f-b41a-4c26-b034-43a46ac407da");
  World world=getServer().getWorlds().getFirst();world.getChunkAt(0,0).load();
  Location[] point={new Location(world,.5,world.getHighestBlockYAt(0,0)+1,.5)};
  boolean[] admin={false};List<String> messages=new ArrayList<>();
  Inventory inventory=Bukkit.createInventory(null,36);
  PlayerInventory pi=(PlayerInventory)Proxy.newProxyInstance(getClass().getClassLoader(),new Class[]{PlayerInventory.class},(proxy,method,args)->{
   try{return Inventory.class.getMethod(method.getName(),method.getParameterTypes()).invoke(inventory,args);}
   catch(NoSuchMethodException e){return defaultValue(method.getReturnType());}
  });
  Player player=(Player)Proxy.newProxyInstance(getClass().getClassLoader(),new Class[]{Player.class},(proxy,method,args)->switch(method.getName()){
   case "getUniqueId" -> id;case "getName" -> "HarborVerifier";case "getWorld" -> world;case "getLocation" -> point[0].clone();
   case "hasPermission","isOp" -> admin[0];case "getInventory" -> pi;case "getServer" -> getServer();
   case "teleport" -> {point[0]=((Location)args[0]).clone();yield true;}
   case "getNearbyEntities" -> new ArrayList<>(world.getNearbyEntities(point[0],(double)args[0],(double)args[1],(double)args[2]));
   case "sendMessage" -> {if(args!=null)for(Object a:args)if(a instanceof Component||a instanceof String)messages.add(a.toString());yield null;}
   case "isOnline","isValid" -> true;case "toString" -> "HarborVerifier";case "hashCode" -> id.hashCode();case "equals" -> proxy==args[0];
   default -> defaultValue(method.getReturnType());
  });
  NamespacedKey key=new NamespacedKey(plugin,"harbor-role");
  Path progress=plugin.getDataFolder().toPath().resolve("progress.properties");
  if(phase==1){
   admin[0]=true;command(plugin,player,"remove");command(plugin,player,"reset");admin[0]=false;
   command(plugin,player,"setup");check(world.getEntities().stream().noneMatch(e->e.getPersistentDataContainer().has(key,PersistentDataType.STRING)),"admin denied setup");
   admin[0]=true;command(plugin,player,"setup");
   check(npcs(world,key).size()==3,"three actual villagers");command(plugin,player,"setup");check(npcs(world,key).size()==3,"duplicate setup blocked");
   Entity mara=role(world,key,"mara");messages.clear();
   getServer().getPluginManager().callEvent(new PlayerInteractEntityEvent(player,mara,EquipmentSlot.OFF_HAND));check(messages.isEmpty(),"off hand ignored");
   PlayerInteractEntityEvent click=new PlayerInteractEntityEvent(player,mara,EquipmentSlot.HAND);
   getServer().getPluginManager().callEvent(click);check(click.isCancelled()&&!messages.isEmpty(),"real event dialogue");
   check(messages.stream().anyMatch(s->s.contains("run_command")),"clickable chat choice");
   command(plugin,player,"later");check(snapshot(progress,id).stage()==Quest.Stage.NEW,"decline no progress");
   command(plugin,player,"accept");check(snapshot(progress,id).stage()==Quest.Stage.SUPPLY,"accept persists");
   talk(plugin,player,world,key,"lev");command(plugin,player,"offer");check(snapshot(progress,id).copper()==0,"missing inventory blocked");
   inventory.addItem(new ItemStack(Material.COPPER_INGOT,3));command(plugin,player,"offer");check(snapshot(progress,id).copper()==1&&inventory.contains(Material.COPPER_INGOT,2)&&!inventory.contains(Material.COPPER_INGOT,3),"exactly one ingot");
   Location old=point[0];point[0]=old.clone().add(100,0,0);command(plugin,player,"offer");check(snapshot(progress,id).copper()==1,"distance guard");
   point[0]=old;talk(plugin,player,world,key,"nika");command(plugin,player,"inspect");check(snapshot(progress,id).stage()==Quest.Stage.SUPPLY,"early inspection blocked");
  }else if(phase==2){
   check(npcs(world,key).size()==3,"NPC PDC survives full restart");check(snapshot(progress,id).copper()==1,"player progress survives full restart");
   talk(plugin,player,world,key,"lev");inventory.addItem(new ItemStack(Material.COPPER_INGOT,3));
   command(plugin,player,"offer");command(plugin,player,"offer");check(snapshot(progress,id).stage()==Quest.Stage.INSPECTION&&inventory.contains(Material.COPPER_INGOT,1),"supply guard");
   command(plugin,player,"offer");check(inventory.contains(Material.COPPER_INGOT,1),"extra resource not consumed");
   command(plugin,player,"claim");check(snapshot(progress,id).stage()==Quest.Stage.INSPECTION,"wrong role blocked");
   talk(plugin,player,world,key,"nika");command(plugin,player,"inspect");check(snapshot(progress,id).stage()==Quest.Stage.RETURN,"inspection transition");
   talk(plugin,player,world,key,"mara");for(int i=0;i<36;i++)inventory.setItem(i,new ItemStack(Material.STONE,64));
   command(plugin,player,"claim");check(snapshot(progress,id).stage()==Quest.Stage.RETURN&&!inventory.contains(Material.EMERALD),"full bag preserves reward");
   inventory.clear();command(plugin,player,"claim");check(snapshot(progress,id).stage()==Quest.Stage.COMPLETE&&inventory.contains(Material.EMERALD,1),"actual inventory reward");
   command(plugin,player,"claim");check(!inventory.contains(Material.EMERALD,2),"repeat reward blocked");
   admin[0]=false;command(plugin,player,"reset");check(snapshot(progress,id).stage()==Quest.Stage.COMPLETE,"unauthorized reset blocked");
  }else{
   check(snapshot(progress,id).stage()==Quest.Stage.COMPLETE,"completion survives another restart");
   talk(plugin,player,world,key,"mara");command(plugin,player,"claim");check(!inventory.contains(Material.EMERALD),"no duplicate after restart");
   admin[0]=true;command(plugin,player,"reset");check(snapshot(progress,id).equals(Quest.fresh()),"admin own reset");
   command(plugin,player,"remove");check(npcs(world,key).isEmpty(),"remove only plugin NPCs");
  }
  getLogger().info("HARBOR_VERIFY_PASS_PHASE"+phase+" checks="+checks+"; Paper world/entities/events, controlled Player proxy");
 }
 private static Object defaultValue(Class<?> t){if(!t.isPrimitive()||t==void.class)return null;if(t==boolean.class)return false;if(t==double.class)return 0d;if(t==float.class)return 0f;if(t==long.class)return 0L;if(t==short.class)return (short)0;if(t==byte.class)return (byte)0;if(t==char.class)return (char)0;return 0;}
 private static Quest snapshot(Path file,UUID id)throws Exception{return new QuestStore(file).get(id);}
 private static List<Entity> npcs(World w,NamespacedKey k){return w.getEntities().stream().filter(e->e.getPersistentDataContainer().has(k,PersistentDataType.STRING)).toList();}
 private static Entity role(World w,NamespacedKey k,String role){return npcs(w,k).stream().filter(e->role.equals(e.getPersistentDataContainer().get(k,PersistentDataType.STRING))).findFirst().orElseThrow();}
 private static void command(JavaPlugin p,Player player,String... args){p.onCommand(player,p.getCommand("harbor"),"harbor",args);}
 private static void talk(JavaPlugin p,Player player,World w,NamespacedKey k,String role){Entity npc=role(w,k,role);player.teleport(npc.getLocation());Bukkit.getPluginManager().callEvent(new PlayerInteractEntityEvent(player,npc,EquipmentSlot.HAND));}
}
