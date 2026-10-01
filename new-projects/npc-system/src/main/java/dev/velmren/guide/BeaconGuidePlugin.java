package dev.velmren.guide;
import java.io.IOException;
import java.util.*;
import org.bukkit.*;
import org.bukkit.command.*;
import org.bukkit.entity.*;
import org.bukkit.event.*;
import org.bukkit.event.player.PlayerInteractEntityEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.inventory.*;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.java.JavaPlugin;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.format.NamedTextColor;
public final class BeaconGuidePlugin extends JavaPlugin implements Listener {
 private QuestStore store;
 private NamespacedKey roleKey;
 private final Map<UUID,UUID> conversations=new HashMap<>();
 private static final Map<String,String> NAMES=Map.of("mara","Мара · смотритель гавани","lev","Лев · мастер","nika","Ника · сигнальщик");
 @Override public void onEnable(){
  saveDefaultConfig();roleKey=new NamespacedKey(this,"harbor-role");
  try{store=new QuestStore(getDataFolder().toPath().resolve("progress.properties"));}
  catch(IOException e){getLogger().severe(e.toString());getServer().getPluginManager().disablePlugin(this);return;}
  getServer().getPluginManager().registerEvents(this,this);
  Objects.requireNonNull(getCommand("harbor")).setTabCompleter((s,c,l,a)->a.length==1?List.of("status","talk","accept","offer","inspect","claim","setup","remove","reset"):List.of());
  getLogger().info("North Harbor ready; persistent progress; /harbor setup");
 }
 @EventHandler public void interact(PlayerInteractEntityEvent e){
  String role=e.getRightClicked().getPersistentDataContainer().get(roleKey,PersistentDataType.STRING);
  if(!NAMES.containsKey(role==null?"":role))return;
  e.setCancelled(true);
  if(e.getHand()!=EquipmentSlot.HAND)return;
  conversations.put(e.getPlayer().getUniqueId(),e.getRightClicked().getUniqueId());talk(e.getPlayer(),role);
 }
 @EventHandler public void quit(PlayerQuitEvent e){conversations.remove(e.getPlayer().getUniqueId());}
 private void say(Player p,String m){p.sendMessage(Component.text("[Северная гавань] ",NamedTextColor.GOLD).append(Component.text(m,NamedTextColor.WHITE)));}
 private void choice(Player p,String t,String a){p.sendMessage(Component.text("  [ "+t+" ]",NamedTextColor.AQUA).clickEvent(ClickEvent.runCommand("/harbor "+a)));}
 private String currentRole(Player p){
  UUID id=conversations.get(p.getUniqueId());Entity e=id==null?null:getServer().getEntity(id);
  if(e==null||!e.isValid()||!e.getWorld().equals(p.getWorld())||e.getLocation().distanceSquared(p.getLocation())>36)return "";
  return Objects.requireNonNullElse(e.getPersistentDataContainer().get(roleKey,PersistentDataType.STRING),"");
 }
 private void talk(Player p,String role){
  Quest q=store.get(p.getUniqueId());say(p,NAMES.get(role));
  switch(role){
   case "mara" -> {
    switch(q.stage()){
     case NEW -> {say(p,"Буря повредила сигнальный фонарь. Поможешь вернуть свет? Льву нужны три медных слитка, а Ника проверит сигнал.");choice(p,"Помогу гавани","accept");choice(p,"Пока не готов","later");}
     case RETURN -> {say(p,"Ника подтвердила сигнал. Спасибо! Твой изумруд ждёт.");choice(p,"Завершить задание","claim");}
     case COMPLETE -> say(p,"Фонарь снова светит. Награда уже выдана. Удачного пути!");
     default -> say(p,"Передай Льву три слитка, затем поговори с Никой у фонаря.");
    }
   }
   case "lev" -> {
    if(q.stage()==Quest.Stage.NEW)say(p,"Мара расскажет, чем помочь гавани. Сначала поговори с ней.");
    else if(q.stage()==Quest.Stage.SUPPLY){say(p,"Нужно три медных слитка. Уже получил: "+q.copper()+"/3. Передавай по одному — так ничего лишнего не потратим.");choice(p,"Передать медный слиток","offer");}
    else say(p,"Контакты готовы. Ника проверяет сигнал у фонаря.");
   }
   case "nika" -> {
    if(q.stage()==Quest.Stage.INSPECTION){say(p,"Контакты на месте. Осталось проверить сигнал. Готов?");choice(p,"Проверить фонарь","inspect");}
    else if(q.stage()==Quest.Stage.RETURN||q.stage()==Quest.Stage.COMPLETE)say(p,"Сигнал чистый. Можешь возвращаться к Маре.");
    else say(p,"Без трёх медных слитков проверка не получится. Загляни к Льву.");
   }
  }
 }
 @Override public boolean onCommand(CommandSender sender,Command cmd,String label,String[] args){
  if(!(sender instanceof Player p)){sender.sendMessage("Команда доступна игроку. /harbor setup создаёт NPC возле игрока.");return true;}
  String action=args.length==0?"status":args[0].toLowerCase(Locale.ROOT);Quest before=store.get(p.getUniqueId());
  try{
   if(List.of("setup","remove","reset").contains(action)){
    if(!p.hasPermission("northharbor.admin")){say(p,"Нужно разрешение northharbor.admin.");return true;}
    if(action.equals("reset")){store.save(p.getUniqueId(),Quest.fresh());say(p,"Только твоё задание сброшено. Предметы не возвращены.");return true;}
    if(action.equals("remove")){
     int n=0;for(Entity e:p.getNearbyEntities(32,32,32))if(e.getPersistentDataContainer().has(roleKey,PersistentDataType.STRING)){e.remove();n++;}
     say(p,"Удалено NPC поблизости: "+n);return true;
    }
    if(p.getNearbyEntities(32,32,32).stream().anyMatch(e->e.getPersistentDataContainer().has(roleKey,PersistentDataType.STRING))){say(p,"NPC уже есть поблизости. Используй /harbor remove перед новым размещением.");return true;}
    for(String role:List.of("mara","lev","nika")){
     Location point=p.getLocation().clone().add(getConfig().getDouble("npc."+role+".x"),0,getConfig().getDouble("npc."+role+".z"));
     Villager npc=p.getWorld().spawn(point,Villager.class);npc.customName(Component.text(NAMES.get(role)));npc.setCustomNameVisible(true);
     npc.setAI(false);npc.setInvulnerable(true);npc.setSilent(true);npc.setCollidable(false);npc.setRemoveWhenFarAway(false);npc.setAdult();
     npc.setProfession(role.equals("lev")?Villager.Profession.TOOLSMITH:role.equals("nika")?Villager.Profession.CARTOGRAPHER:Villager.Profession.FISHERMAN);
     npc.getPersistentDataContainer().set(roleKey,PersistentDataType.STRING,role);
    }
    say(p,"Три NPC размещены. Правая кнопка мыши открывает диалог.");return true;
   }
   if(action.equals("status")){say(p,"Этап: "+before.stage()+", медь: "+before.copper()+"/3. Прогресс сохраняется после каждого шага.");return true;}
   if(action.equals("talk")&&args.length==2&&NAMES.containsKey(args[1])){
    Entity npc=p.getNearbyEntities(6,6,6).stream().filter(e->args[1].equals(e.getPersistentDataContainer().get(roleKey,PersistentDataType.STRING))&&e.getLocation().distanceSquared(p.getLocation())<=36).findFirst().orElse(null);
    if(npc!=null){conversations.put(p.getUniqueId(),npc.getUniqueId());talk(p,args[1]);}else say(p,"Подойди к нужному персонажу на расстояние до 6 блоков.");
    return true;
   }
   if(action.equals("later")){say(p,"Хорошо. Задание можно принять у Мары, когда будешь готов.");return true;}
   String needed=switch(action){case "accept","claim"->"mara";case "offer"->"lev";case "inspect"->"nika";default->"";};
   if(needed.isEmpty()){say(p,"Неизвестное действие. /harbor status или /harbor talk mara|lev|nika.");return true;}
   if(!needed.equals(currentRole(p))){say(p,"Подойди к персонажу «"+NAMES.get(needed)+"» и открой диалог ещё раз.");return true;}
   Quest next=before.apply(action);
   if(next.equals(before)){say(p,"Этот шаг сейчас недоступен. Проверь /harbor status.");return true;}
   if(action.equals("offer")&&!p.getInventory().contains(Material.COPPER_INGOT,1)){say(p,"В инвентаре нет медного слитка. Добудь медь и возвращайся.");return true;}
   if(action.equals("claim")&&p.getInventory().firstEmpty()==-1){say(p,"Освободи одну ячейку инвентаря. Награда и задание сохранены.");return true;}
   store.save(p.getUniqueId(),next);
   if(action.equals("offer"))p.getInventory().removeItem(new ItemStack(Material.COPPER_INGOT,1));
   if(action.equals("claim"))p.getInventory().addItem(new ItemStack(Material.EMERALD,1));
   say(p,switch(action){case "accept"->"Задание принято. Найди Льва с тремя медными слитками.";case "offer"->"Передан один слиток. Всего: "+next.copper()+"/3.";case "inspect"->"Сигнал проверен. Вернись к Маре за наградой.";default->"Гавань снова на связи. Получен 1 изумруд.";});
   talk(p,needed);
  }catch(IOException e){getLogger().severe("Progress save failed: "+e);say(p,"Не удалось сохранить шаг. Предметы не изменены. Попробуй позже или сообщи администратору.");}
  return true;
 }
}
