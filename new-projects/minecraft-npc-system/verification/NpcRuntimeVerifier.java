package dev.velmren.npc.verify;
import dev.velmren.npc.*;
import org.bukkit.*;import org.bukkit.entity.*;import org.bukkit.event.player.*;import org.bukkit.event.block.*;import org.bukkit.inventory.*;import org.bukkit.plugin.java.JavaPlugin;import org.bukkit.configuration.file.YamlConfiguration;
import java.util.*;import java.nio.file.*;
import java.lang.reflect.*;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.event.*;
import org.bukkit.event.entity.EntityDeathEvent;
import org.bukkit.permissions.PermissionAttachment;
/** Test-only plugin: uses actual connected Minecraft protocol Players, never Java proxies. */
public final class NpcRuntimeVerifier extends JavaPlugin implements Listener {
 MinecraftNpcPlugin system;Player a,b;int assertions;List<String> evidence=new ArrayList<>();
 void check(boolean ok,String message){if(!ok)throw new IllegalStateException(message);assertions++;evidence.add("PASS "+message);}
 private final Set<UUID> testMobs = new HashSet<>();
 private int observedDeaths;
 private boolean phaseRunning;
 private Runnable pendingCleanup;
 public void onEnable(){
  system=(MinecraftNpcPlugin)Bukkit.getPluginManager().getPlugin("MinecraftNPCSystem");
  Bukkit.getPluginManager().registerEvents(this,this);
  getCommand("npcverify").setExecutor((s,c,l,args)->{
   try{
    if(args.length==0)return false;
    if(args[0].equalsIgnoreCase("preview")){
     if(args.length!=2)throw new IllegalArgumentException("Use /npcverify preview <npc>");
     Player viewer=Bukkit.getPlayerExact("NPCDev");if(viewer==null)throw new IllegalStateException("Connect the actual NPCDev graphical client first");
     Entity npc=system.npcs.entity(args[1]);if(npc==null||!npc.isValid()||!npc.getWorld().getName().equals("npc_demo"))throw new IllegalArgumentException("Requested demo NPC is not spawned");
     at(viewer,args[1]);system.dialogue.open(viewer,args[1]);
     if(!(viewer.getOpenInventory().getTopInventory().getHolder() instanceof DialogueEngine.Menu))throw new IllegalStateException("Production dialogue access denied for NPCDev");
     s.sendMessage("NPC_VERIFY_PREVIEW "+args[1]+": actual production menu opened for NPCDev");return true;
    }
    if(phaseRunning){s.sendMessage("NPC_VERIFY_BUSY: a verifier phase is already running");return true;}
    String phase=args[0];a=Bukkit.getPlayerExact("NPCAlpha");b=Bukkit.getPlayerExact("NPCBeta");
    if(a==null||b==null)throw new IllegalStateException("Connect both actual network clients first");
    phaseRunning=true;
    if(phase.equals("run"))run();
    else if(phase.equals("restart"))restart();
    else if(phase.equals("graphs"))graphs();
    else if(phase.equals("integrations")){integrations(s);return true;}
    else throw new IllegalArgumentException("Use run, restart, graphs or integrations");
    report(phase,s);
   }catch(Throwable e){failed(s,e);}
   return true;
  });
 }
 public void onDisable(){if(pendingCleanup!=null)try{pendingCleanup.run();}catch(RuntimeException error){getLogger().severe("Verifier shutdown restoration failed: "+error);}}
 void report(String phase,CommandSender sender)throws Exception{save(phase);phaseRunning=false;sender.sendMessage("NPC_VERIFY_PASS "+phase+" "+assertions);}
 void failed(CommandSender sender,Throwable error){phaseRunning=false;getLogger().severe("NPC_VERIFY_FAIL "+error);error.printStackTrace();sender.sendMessage("NPC_VERIFY_FAIL "+error.getMessage());}
 @EventHandler(priority=EventPriority.MONITOR)
 public void observedDeath(EntityDeathEvent event){if(testMobs.contains(event.getEntity().getUniqueId())){if(event.getEntity().getKiller()==a)observedDeaths++;event.getDrops().clear();event.setDroppedExp(0);}}
 void killZombie(Player player,Location location){
  Zombie zombie=(Zombie)location.getWorld().spawnEntity(location,EntityType.ZOMBIE);
  testMobs.add(zombie.getUniqueId());int before=observedDeaths;
  try{zombie.setAI(false);zombie.setSilent(true);zombie.setPersistent(false);zombie.damage(1000,player);check(observedDeaths==before+1,"real player damage fired attributed EntityDeathEvent");}
  finally{testMobs.remove(zombie.getUniqueId());if(zombie.isValid())zombie.remove();}
 }
 void fresh(Player p)throws Exception{system.progress.set(p.getUniqueId(),"quests",null);system.progress.set(p.getUniqueId(),"variables",null);p.getInventory().clear();p.closeInventory();}
 void at(Player p,String npc){p.teleport(system.npcs.entity(npc).getLocation().clone().add(0,0,2));}
 void loadConfiguredNpcChunks(){
  List<org.bukkit.Chunk> chunks=new ArrayList<>();
  for(var definition:system.definitions.npcs.values()){
   if(!definition.getBoolean("enabled",true))continue;
   Location location=system.definitions.location(definition);if(location==null)continue;
   org.bukkit.Chunk chunk=location.getChunk();if(!chunk.load())throw new IllegalStateException("Could not load configured NPC chunk "+chunk.getX()+","+chunk.getZ());chunks.add(chunk);
  }
  // Apply the normal chunk-load cleanup synchronously before counting. The plugin's
  // queued ChunkLoadEvent work otherwise runs only after this command returns.
  for(org.bukkit.Chunk chunk:chunks)system.npcs.chunkLoaded(chunk);
  system.npcs.reconcile();
 }
 void interact(Player p,String npc,EquipmentSlot hand){at(p,npc);Bukkit.getPluginManager().callEvent(new PlayerInteractEntityEvent(p,system.npcs.entity(npc),hand));}
 void stage(Player p,String q,int n){check(system.quests.stage(p,q)==n,q+" stage "+n);}
 int count(Player p,Material m){return InventoryOps.count(p.getInventory(),m);}
 void give(Player p,Material m,int n){InventoryOps.give(p.getInventory(),m,n);}
 void ready(String q,int stage)throws Exception{system.progress.change(a.getUniqueId(),Map.of("quests."+q+".active",true,"quests."+q+".stage",stage,"quests."+q+".count",0));}
 void claim(String q){check(system.claimQuest(a,q),"claim "+q);check(system.isCompleted(a,q),"completed "+q);int emeralds=count(a,Material.EMERALD);check(!system.claimQuest(a,q),"duplicate "+q+" claim rejected");check(count(a,Material.EMERALD)==emeralds,"duplicate reward preserved inventory");}
 void run()throws Exception{
  assertions=0;evidence.clear();fresh(a);fresh(b);World w=Bukkit.getWorld("npc_demo");check(w!=null,"actual demo world loaded");
  loadConfiguredNpcChunks();
  long npcs=w.getEntities().stream().filter(e->system.npcs.id(e)!=null).count();check(npcs==8,"exactly eight managed entities");for(String id:system.definitions.npcs.keySet()){Entity e=system.npcs.entity(id);check(e!=null&&e.isValid(),"real NPC "+id);check(e.getLocation().getBlock().isPassable(),"NPC feet clear "+id);}
  check(!system.acceptQuest(a,"mill"),"dependency blocks mill before welcome");check(!system.claimQuest(a,"welcome"),"early reward denied");check(system.acceptQuest(a,"welcome"),"welcome accepted");check(!system.acceptQuest(a,"welcome"),"duplicate accept denied");check(!system.isActive(b,"welcome"),"UUID players independent");
  at(a,"smith");system.quests.poll(a);stage(a,"welcome",1);system.quests.talk(a,"merchant");stage(a,"welcome",1);system.quests.talk(a,"smith");stage(a,"welcome",2);
  for(int i=0;i<36;i++)a.getInventory().setItem(i,new ItemStack(Material.COBBLESTONE,64));check(!system.claimQuest(a,"welcome"),"full inventory reward rejected");check(system.isActive(a,"welcome"),"full inventory retains quest");a.getInventory().clear();claim("welcome");check(count(a,Material.EMERALD)==5,"actual five emerald reward");
  check(system.acceptQuest(a,"mill"),"mill accepted");give(a,Material.OAK_LOG,8);system.quests.poll(a);stage(a,"mill",1);int before=count(a,Material.OAK_LOG);interact(a,"lumberjack",EquipmentSlot.OFF_HAND);check(count(a,Material.OAK_LOG)==before,"offhand delivery ignored");system.quests.talk(a,"lumberjack");stage(a,"mill",2);check(count(a,Material.OAK_LOG)==0,"exact timber delivery consumed");claim("mill");check(w.getBlockAt(-35,66,-10).getType()==Material.OAK_PLANKS,"actual mill environment restored");
  check(system.acceptQuest(a,"forge"),"forge dependency satisfied");give(a,Material.IRON_INGOT,4);system.quests.poll(a);system.quests.talk(a,"smith");stage(a,"forge",2);system.quests.talk(a,"keeper");stage(a,"forge",3);claim("forge");check(count(a,Material.BREAD)==3,"forge item reward");
  check(system.acceptQuest(a,"lighthouse"),"lighthouse accepted");a.teleport(new Location(w,42,78,10));system.quests.poll(a);stage(a,"lighthouse",1);system.quests.talk(a,"keeper");stage(a,"lighthouse",1);give(a,Material.GLASS,4);system.quests.talk(a,"keeper");stage(a,"lighthouse",2);system.signal(a,"wrong_event");stage(a,"lighthouse",2);system.signal(a,"lens_align");stage(a,"lighthouse",3);claim("lighthouse");check(w.getBlockAt(42,79,10).getType()==Material.SEA_LANTERN,"actual lighthouse light restored");check(system.progress.flag(a.getUniqueId(),"variables.lighthouse_restored"),"quest variable persisted");
  check(system.acceptQuest(a,"survey"),"survey accepted");for(Location l:List.of(new Location(w,-35,65,-10),new Location(w,42,65,10),new Location(w,0,65,-26))){a.teleport(l);system.quests.poll(a);}system.quests.talk(a,"cartographer");stage(a,"survey",4);claim("survey");
  check(system.acceptQuest(a,"harvest"),"harvest accepted");a.teleport(new Location(w,-20,65,18));org.bukkit.block.Block wheat=w.getBlockAt(-25,65,17);wheat.setType(Material.WHEAT);for(int i=0;i<6;i++)Bukkit.getPluginManager().callEvent(new BlockBreakEvent(wheat,a));stage(a,"harvest",1);give(a,Material.WHEAT,6);system.quests.talk(a,"farmer");claim("harvest");check(!system.acceptQuest(a,"harvest"),"repeat quest cooldown enforced");
  check(system.acceptQuest(a,"market"),"market accepted");give(a,Material.WHEAT,4);system.quests.talk(a,"merchant");claim("market");check(!system.acceptQuest(a,"market"),"market cooldown enforced");
  check(system.acceptQuest(a,"patrol"),"patrol accepted");at(a,"guard");killZombie(a,a.getLocation().clone().add(2,0,0));stage(a,"patrol",0);check(system.progress.integer(a.getUniqueId(),"quests.patrol.count")==1,"death listener records first zombie");killZombie(a,a.getLocation().clone().add(2,0,0));stage(a,"patrol",1);system.quests.talk(a,"guard");claim("patrol");
  shopTests();accessTests();validationTests();check(system.acceptQuest(b,"welcome"),"second player welcome accepted");at(b,"smith");system.quests.poll(b);stage(b,"welcome",1);check(!system.isCompleted(b,"welcome"),"second player partial progress independent");
 }
 void shopTests(){a.getInventory().clear();system.shops.trade(a,"market",0,true);check(count(a,Material.BREAD)==0,"shop rejects insufficient emeralds");give(a,Material.EMERALD,10);system.shops.trade(a,"market",0,true);check(count(a,Material.BREAD)==3&&count(a,Material.EMERALD)==8,"buy actual bread and debit currency");system.shops.trade(a,"market",0,false);check(count(a,Material.BREAD)==0&&count(a,Material.EMERALD)==9,"sell actual bread and credit currency");system.shops.trade(a,"market",0,false);check(count(a,Material.EMERALD)==9,"sell missing item rejected");a.getInventory().clear();for(int i=0;i<36;i++)a.getInventory().setItem(i,new ItemStack(Material.COBBLESTONE,64));a.getInventory().setItem(0,new ItemStack(Material.EMERALD,64));system.shops.trade(a,"market",0,true);check(count(a,Material.EMERALD)==64&&count(a,Material.BREAD)==0,"full inventory shop rolls back payment");a.getInventory().clear();}
 String menuToken(Player p){return ((DialogueEngine.Menu)p.getOpenInventory().getTopInventory().getHolder()).token;}
 void accessTests()throws Exception{
  at(a,"elder");system.dialogue.open(a,"elder");check(a.getOpenInventory().getTopInventory().getHolder() instanceof DialogueEngine.Menu,"Minecraft inventory dialogue UI");String token=menuToken(a);
  system.dialogue.choose(b,token,0);check(!(b.getOpenInventory().getTopInventory().getHolder() instanceof DialogueEngine.Menu),"nonce bound to player");
  a.teleport(a.getLocation().clone().add(50,0,0));String before=state(a);ItemStack[] inventory=items(a.getInventory().getContents());system.dialogue.choose(a,token,0);
  check(state(a).equals(before)&&Arrays.equals(inventory,a.getInventory().getContents()),"distance choice preserves progress and inventory actions");
  InventoryHolder holder=a.getOpenInventory().getTopInventory().getHolder();check(!(holder instanceof DialogueEngine.Menu menu)||menu.token.equals(token),"distance choice creates no fresh dialogue menu");
  // Teleport may close the inventory on old servers. Open a fresh authenticated
  // session before testing valid choice and replay, independently of that UI policy.
  at(a,"elder");system.dialogue.open(a,"elder");token=menuToken(a);system.dialogue.choose(a,token,0);check(!menuToken(a).equals(token),"valid graph choice creates fresh nonce");String next=menuToken(a);before=state(a);system.dialogue.choose(a,token,0);check(menuToken(a).equals(next)&&state(a).equals(before),"old nonce replay rejected");a.closeInventory();
  var attachment=a.addAttachment(this,"npcs.admin",false);try{system.onCommand(a,system.getCommand("npcs"),"npcs",new String[]{"despawn","elder"});check(system.npcs.entity("elder")!=null,"admin command permission enforced");}finally{attachment.remove();}
  var use=a.addAttachment(this,"npcs.use",false);try{system.dialogue.open(a,"elder");check(!(a.getOpenInventory().getTopInventory().getHolder() instanceof DialogueEngine.Menu),"dialogue use permission enforced");}finally{use.remove();}
 }
 void validationTests()throws Exception{String old=system.definitions.yaml.saveToString();boolean rejected=false;try{Definitions.parse(old+"\neconomy: invalid\n");}catch(Exception x){rejected=true;}check(rejected,"invalid economics rejected");Path file=system.getDataFolder().toPath().resolve("dialogs.yml");String original=Files.readString(file);Files.writeString(file,"dialogs: [invalid\n");Definitions active=system.definitions;system.onCommand(Bukkit.getConsoleSender(),system.getCommand("npcs"),"npcs",new String[]{"reload"});check(system.definitions==active,"malformed reload retains active snapshot");check(system.npcs.entity("elder")!=null,"malformed reload retains actual NPC");Files.writeString(file,original);system.onCommand(Bukkit.getConsoleSender(),system.getCommand("npcs"),"npcs",new String[]{"reload"});check(system.definitions!=active,"correct config reload accepted");}
 void restart(){assertions=0;evidence.clear();check(system.isCompleted(a,"lighthouse"),"restart completed chain persisted");check(system.isCompleted(a,"welcome"),"restart first player completion persisted");check(system.isActive(b,"welcome"),"restart second player active persisted");stage(b,"welcome",1);check(!system.claimQuest(a,"lighthouse"),"restart duplicate reward prevented");check(Bukkit.getWorld("npc_demo").getBlockAt(42,79,10).getType()==Material.SEA_LANTERN,"restart real light persisted");loadConfiguredNpcChunks();for(String id:system.definitions.npcs.keySet())check(system.npcs.entity(id)!=null&&system.npcs.entity(id).isValid(),"restart live configured NPC "+id);check(Bukkit.getWorld("npc_demo").getEntities().stream().filter(e->system.npcs.id(e)!=null).count()==8,"restart eight NPCs without duplicates");}
 // Every graph/integration fixture restores the two test players' durable progress,
 // inventories, positions, configuration and quest repair blocks, even on failure.
 Object detached(Object value){
  if(value instanceof ConfigurationSection section){Map<String,Object> copy=new LinkedHashMap<>();for(String key:section.getKeys(false))copy.put(key,detached(section.get(key)));return copy;}
  if(value instanceof Map<?,?> map){Map<String,Object> copy=new LinkedHashMap<>();for(var entry:map.entrySet())copy.put(String.valueOf(entry.getKey()),detached(entry.getValue()));return copy;}
  if(value instanceof List<?> list){List<Object> copy=new ArrayList<>();for(Object item:list)copy.add(detached(item));return copy;}
  return value;
 }
 ItemStack[] items(ItemStack[] contents){ItemStack[] copy=contents.clone();for(int i=0;i<copy.length;i++)if(copy[i]!=null)copy[i]=copy[i].clone();return copy;}
 final class Fixture implements AutoCloseable {
  final Definitions definitions=system.definitions;
  final Map<Player,Map<String,Object>> progress=new LinkedHashMap<>();
  final Map<Player,ItemStack[]> inventory=new LinkedHashMap<>();
  final Map<Player,Location> locations=new LinkedHashMap<>();
  final Map<org.bukkit.block.Block,org.bukkit.block.data.BlockData> blocks=new LinkedHashMap<>();
  Fixture(){
   for(Player player:List.of(a,b)){Map<String,Object> state=new HashMap<>();for(String key:List.of("quests","variables"))state.put(key,detached(system.progress.value(player.getUniqueId(),key)));progress.put(player,state);inventory.put(player,items(player.getInventory().getContents()));locations.put(player,player.getLocation().clone());}
   for(var quest:definitions.quests.values())for(Map<?,?> raw:quest.getMapList("rewards")){var reward=Definitions.section(raw);if(reward.getString("type","").equals("block")){Location location=definitions.location(reward);if(location!=null)blocks.put(location.getBlock(),location.getBlock().getBlockData().clone());}}
  }
  public void close()throws Exception{
   system.definitions=definitions;system.dialogue.clear();
   for(var entry:blocks.entrySet())entry.getKey().setBlockData(entry.getValue(),false);
   for(Player player:progress.keySet()){player.closeInventory();system.progress.change(player.getUniqueId(),progress.get(player));player.getInventory().setContents(inventory.get(player));player.teleport(locations.get(player));}
  }
 }
 String state(Player player){YamlConfiguration yaml=new YamlConfiguration();for(String key:List.of("quests","variables"))yaml.set(key,detached(system.progress.value(player.getUniqueId(),key)));return yaml.saveToString();}
 List<PermissionAttachment> conditionAttachments=new ArrayList<>();
 void clearConditionPermissions(){for(PermissionAttachment attachment:conditionAttachments)attachment.remove();conditionAttachments.clear();}
 void condition(ConfigurationSection condition,boolean pass)throws Exception{
  boolean desired=condition.getBoolean("not",false)?!pass:pass;
  switch(condition.getString("type","")){
   case "permission"->conditionAttachments.add(a.addAttachment(this,condition.getString("permission"),desired));
   case "active"->system.progress.set(a.getUniqueId(),"quests."+condition.getString("quest")+".active",desired);
   case "completed"->system.progress.set(a.getUniqueId(),"quests."+condition.getString("quest")+".completions",desired?1:0);
   case "variable"->system.progress.set(a.getUniqueId(),"variables."+condition.getString("key"),desired?condition.get("value"):"verifier-mismatch");
   case "item"->{Material material=Definitions.material(condition.getString("material"));InventoryOps.remove(a.getInventory(),material,count(a,material));if(desired)give(a,material,condition.getInt("amount",1));}
   default->throw new IllegalArgumentException("Unknown verifier condition");
  }
 }
 void satisfy(ConfigurationSection choice)throws Exception{for(Map<?,?> raw:choice.getMapList("conditions"))condition(Definitions.section(raw),true);}
 void prepareActions(ConfigurationSection choice)throws Exception{
  for(Map<?,?> raw:choice.getMapList("actions")){
   var action=Definitions.section(raw);String type=action.getString("type","");String quest=action.getString("quest","");
   if(type.equals("quest")){
    var definition=system.definitions.quests.get(quest);for(String dependency:definition.getStringList("requires"))system.progress.set(a.getUniqueId(),"quests."+dependency+".completions",1);
    system.progress.change(a.getUniqueId(),Map.of("quests."+quest+".active",false,"quests."+quest+".completions",0,"quests."+quest+".last-completed",0L,"quests."+quest+".claim-pending",false));
   }else if(type.equals("complete")){
    ready(quest,system.definitions.quests.get(quest).getMapList("stages").size());system.progress.set(a.getUniqueId(),"quests."+quest+".claim-pending",false);
   }else if(type.equals("event")){
    for(var entry:system.definitions.quests.entrySet()){List<Map<?,?>> stages=entry.getValue().getMapList("stages");for(int i=0;i<stages.size();i++){var stage=Definitions.section(stages.get(i));if(stage.getString("type","").equalsIgnoreCase("EVENT")&&stage.getString("event","").equals(action.getString("event")))ready(entry.getKey(),i);}}
   }
  }
 }
 record Hop(String node,int choice){}
 Map<String,List<Hop>> paths(ConfigurationSection graph){
  var nodes=graph.getConfigurationSection("nodes");Map<String,List<Hop>> paths=new LinkedHashMap<>();Deque<String> queue=new ArrayDeque<>();String start=graph.getString("start","start");paths.put(start,List.of());queue.add(start);
  while(!queue.isEmpty()){String node=queue.removeFirst();List<Map<?,?>> choices=nodes.getConfigurationSection(node).getMapList("choices");for(int i=0;i<choices.size();i++){String next=Definitions.section(choices.get(i)).getString("next","");if(!next.isEmpty()&&!paths.containsKey(next)){List<Hop> path=new ArrayList<>(paths.get(node));path.add(new Hop(node,i));paths.put(next,List.copyOf(path));queue.add(next);}}}
  check(paths.size()==nodes.getKeys(false).size(),"all nodes reachable in graph");return paths;
 }
 ConfigurationSection choice(ConfigurationSection graph,String node,int index){return Definitions.section(graph.getConfigurationSection("nodes."+node).getMapList("choices").get(index));}
 int visibleIndex(ConfigurationSection graph,String node,int rawIndex){int visible=0;List<Map<?,?>> choices=graph.getConfigurationSection("nodes."+node).getMapList("choices");for(int i=0;i<choices.size();i++){var candidate=Definitions.section(choices.get(i));if(system.dialogue.conditions(a,candidate)){if(i==rawIndex)return visible;visible++;}}return -1;}
 void assertNode(ConfigurationSection graph,String node,String label){
  check(a.getOpenInventory().getTopInventory().getHolder() instanceof DialogueEngine.Menu,"graph node has actual menu "+label);
  Inventory menu=a.getOpenInventory().getTopInventory();int slot=0;
  for(Map<?,?> raw:graph.getConfigurationSection("nodes."+node).getMapList("choices")){var candidate=Definitions.section(raw);if(!system.dialogue.conditions(a,candidate))continue;ItemStack item=menu.getItem(slot++);check(item!=null&&item.getItemMeta().getDisplayName().equals(MinecraftNpcPlugin.color(system.dialogue.format(a,candidate.getString("text")))),"node menu displays expected choice "+label+"/"+(slot-1));}
  boolean noExtras=true;for(int i=slot;i<menu.getSize();i++)if(menu.getItem(i)!=null)noExtras=false;check(noExtras,"node menu excludes hidden/extra choices "+label);
 }
 void openNode(String npc,ConfigurationSection graph,List<Hop> path)throws Exception{
  at(a,npc);system.dialogue.open(a,npc);check(a.getOpenInventory().getTopInventory().getHolder() instanceof DialogueEngine.Menu,"actual graph inventory opens "+npc);assertNode(graph,graph.getString("start","start"),npc+"/start");
  for(Hop hop:path){int index=visibleIndex(graph,hop.node,hop.choice);check(index>=0,"path choice visible "+npc+"/"+hop.node);String token=menuToken(a);system.dialogue.choose(a,token,index);check(a.getOpenInventory().getTopInventory().getHolder() instanceof DialogueEngine.Menu&&!menuToken(a).equals(token),"actual next-node choice traversed "+npc+"/"+hop.node);String next=choice(graph,hop.node,hop.choice).getString("next");assertNode(graph,next,npc+"/"+next);}
 }
 void prepareBranch(ConfigurationSection graph,List<Hop> path,ConfigurationSection selected)throws Exception{
  clearConditionPermissions();fresh(a);
  for(Hop hop:path){var step=choice(graph,hop.node,hop.choice);prepareActions(step);satisfy(step);}
  prepareActions(selected);satisfy(selected);
 }
 void assertAction(ConfigurationSection action){
  String type=action.getString("type","");String quest=action.getString("quest","");
  switch(type){
   case "quest"->check(system.isActive(a,quest),"graph action accepted "+quest);
   case "complete"->check(system.isCompleted(a,quest)&&!system.isActive(a,quest),"graph action claimed "+quest);
   case "variable"->check(Objects.equals(String.valueOf(system.progress.value(a.getUniqueId(),"variables."+action.getString("key"))),String.valueOf(action.get("value"))),"graph variable action "+action.getString("key"));
   case "event"->{for(var entry:system.definitions.quests.entrySet()){List<Map<?,?>> stages=entry.getValue().getMapList("stages");for(int i=0;i<stages.size();i++){var stage=Definitions.section(stages.get(i));if(stage.getString("type","").equalsIgnoreCase("EVENT")&&stage.getString("event","").equals(action.getString("event")))check(system.quests.stage(a,entry.getKey())==i+1,"graph EVENT action advances "+entry.getKey());}}}
   case "message"->evidence.add("PASS trusted configured message action executed (no client-chat assertion)");
   default->throw new IllegalArgumentException("Add observable assertion for graph action "+type);
  }
 }
 int graphNodes,graphChoices,graphConditionDenials;
 void graph(String npc)throws Exception{
  var npcDefinition=system.definitions.npcs.get(npc);String dialog=npcDefinition.getString("dialogue","");if(dialog.isEmpty())return;
  var graph=system.definitions.dialogs.get(dialog);Map<String,List<Hop>> paths=paths(graph);
  for(var node:paths.entrySet()){
   List<Map<?,?>> choices=graph.getConfigurationSection("nodes."+node.getKey()).getMapList("choices");graphNodes++;
   if(choices.isEmpty()){prepareBranch(graph,node.getValue(),new YamlConfiguration());openNode(npc,graph,node.getValue());check(a.getOpenInventory().getTopInventory().getContents().length>=9,"empty terminal node rendered "+dialog+"/"+node.getKey());}
   for(int rawIndex=0;rawIndex<choices.size();rawIndex++){
    var selected=Definitions.section(choices.get(rawIndex));String label=dialog+"/"+node.getKey()+"/"+rawIndex;
    prepareBranch(graph,node.getValue(),selected);openNode(npc,graph,node.getValue());int index=visibleIndex(graph,node.getKey(),rawIndex);check(index>=0,"satisfied choice visible "+label);
    ItemStack item=a.getOpenInventory().getTopInventory().getItem(index);check(item!=null&&item.getItemMeta().getDisplayName().equals(MinecraftNpcPlugin.color(system.dialogue.format(a,selected.getString("text")))),"visible menu item matches choice "+label);
    String token=menuToken(a);system.dialogue.choose(a,token,index);graphChoices++;
    for(Map<?,?> action:selected.getMapList("actions"))assertAction(Definitions.section(action));
    String next=selected.getString("next","");
    if(!next.isEmpty()){check(a.getOpenInventory().getTopInventory().getHolder() instanceof DialogueEngine.Menu&&!menuToken(a).equals(token),"choice enters next node "+label+" -> "+next);assertNode(graph,next,label+" -> "+next);}
    else if(selected.getBoolean("open-shop",false)){check(a.getOpenInventory().getTopInventory().getHolder() instanceof DialogueEngine.Menu,"choice opens shop "+label);check(a.getOpenInventory().getTitle().contains("Shop:"),"real shop menu rendered");}
    else check(!(a.getOpenInventory().getTopInventory().getHolder() instanceof DialogueEngine.Menu),"terminal choice closes menu "+label);
    for(Map<?,?> rawCondition:selected.getMapList("conditions")){
     prepareBranch(graph,node.getValue(),selected);openNode(npc,graph,node.getValue());index=visibleIndex(graph,node.getKey(),rawIndex);token=menuToken(a);condition(Definitions.section(rawCondition),false);String stateBefore=state(a);
     system.dialogue.choose(a,token,index);check(state(a).equals(stateBefore),"changed condition prevents action "+label);check(visibleIndex(graph,node.getKey(),rawIndex)==-1,"failed condition hides choice "+label);assertNode(graph,node.getKey(),label+" denial rerender");graphConditionDenials++;
    }
   }
  }
 }
 void graphs()throws Exception{
  assertions=0;evidence.clear();graphNodes=graphChoices=graphConditionDenials=0;
  try(Fixture fixture=new Fixture()){
   check(system.definitions.dialogs.size()==8,"eight shipped dialogue graphs");for(String npc:system.definitions.npcs.keySet())graph(npc);
   YamlConfiguration yaml=new YamlConfiguration();yaml.loadFromString(system.definitions.yaml.saveToString());yaml.set("npcs.elder.dialogue","verifier_conditions");
   yaml.set("dialogs.verifier_conditions.start","start");yaml.set("dialogs.verifier_conditions.nodes.start.text","Verifier conditions");
   List<Map<String,Object>> tests=new ArrayList<>();
   for(Map<String,Object> condition:List.of(Map.<String,Object>of("type","permission","permission","npcverify.fixture"),Map.<String,Object>of("type","variable","key","fixture","value",true),Map.<String,Object>of("type","item","material","DIAMOND","amount",2))){String type=String.valueOf(condition.get("type"));tests.add(Map.of("text","Fixture "+type,"conditions",List.of(condition),"actions",List.of(Map.of("type","variable","key","chosen","value",type)),"next","finish"));}
   yaml.set("dialogs.verifier_conditions.nodes.start.choices",tests);yaml.set("dialogs.verifier_conditions.nodes.finish.text","Finished");yaml.set("dialogs.verifier_conditions.nodes.finish.choices",List.of(Map.of("text","Close")));
   system.definitions=Definitions.parse(yaml.saveToString());system.dialogue.clear();graph("elder");
   evidence.add("COVERAGE nodes="+graphNodes+" actual choices="+graphChoices+" individual condition denials="+graphConditionDenials+"; includes synthetic permission/variable/item conditions");
  }finally{clearConditionPermissions();}
 }
 Object call(Object target,String method)throws Exception{return target.getClass().getMethod(method).invoke(target);}
 Object call(Object target,String method,Class<?>[] types,Object...values)throws Exception{return target.getClass().getMethod(method,types).invoke(target,values);}
 void invalidateRegionCache(Object container)throws Exception{
  Class<?> type=container.getClass();while(type!=null){try{Field cache=type.getDeclaredField("cache");cache.setAccessible(true);call(cache.get(container),"invalidateAll");return;}catch(NoSuchFieldException absent){type=type.getSuperclass();}}
  throw new IllegalStateException("WorldGuard query cache unavailable; cannot assert immediate region edits");
 }
 void worldGuard()throws Exception{
  if(!Bukkit.getPluginManager().isPluginEnabled("WorldGuard")){evidence.add("SKIP WorldGuard: plugin unavailable");return;}
  World world=Bukkit.getWorld("npc_demo");Location center=system.npcs.entity("elder").getLocation();at(a,"elder");check(system.integrations.allowed(a,center),"WorldGuard allows unprotected NPC location");system.dialogue.open(a,"elder");String token=menuToken(a);
  Object guard=Class.forName("com.sk89q.worldguard.WorldGuard").getMethod("getInstance").invoke(null);Object container=call(call(guard,"getPlatform"),"getRegionContainer");
  Object adapted=Class.forName("com.sk89q.worldedit.bukkit.BukkitAdapter").getMethod("adapt",World.class).invoke(null,world);Object manager=call(container,"get",new Class[]{Class.forName("com.sk89q.worldedit.world.World")},adapted);check(manager!=null,"WorldGuard real region manager available");
  Class<?> vector=Class.forName("com.sk89q.worldedit.math.BlockVector3");Object min=vector.getMethod("at",int.class,int.class,int.class).invoke(null,center.getBlockX()-8,60,center.getBlockZ()-8);Object max=vector.getMethod("at",int.class,int.class,int.class).invoke(null,center.getBlockX()+8,90,center.getBlockZ()+8);
  String id="npc_verifier_"+UUID.randomUUID().toString().replace("-","");Object region=Class.forName("com.sk89q.worldguard.protection.regions.ProtectedCuboidRegion").getConstructor(String.class,vector,vector).newInstance(id,min,max);
  Object interact=Class.forName("com.sk89q.worldguard.protection.flags.Flags").getField("INTERACT").get(null);Object deny=Class.forName("com.sk89q.worldguard.protection.flags.StateFlag$State").getField("DENY").get(null);
  call(region,"setPriority",new Class[]{int.class},1000000);call(region,"setFlag",new Class[]{Class.forName("com.sk89q.worldguard.protection.flags.Flag"),Object.class},interact,deny);
  try{
   call(manager,"addRegion",new Class[]{Class.forName("com.sk89q.worldguard.protection.regions.ProtectedRegion")},region);invalidateRegionCache(container);
   check(!system.integrations.allowed(a,center),"WorldGuard INTERACT DENY blocks real region query");String before=state(a);system.dialogue.choose(a,token,0);check(state(a).equals(before)&&menuToken(a).equals(token),"DENY prevents already-open dialogue choice");a.closeInventory();system.dialogue.open(a,"elder");check(!(a.getOpenInventory().getTopInventory().getHolder() instanceof DialogueEngine.Menu),"DENY prevents opening NPC menu");
  }finally{call(manager,"removeRegion",new Class[]{String.class},id);invalidateRegionCache(container);}
  check(system.integrations.allowed(a,center),"temporary region removal restores interaction");
 }
 double balance(Object economy,Class<?> type)throws Exception{return ((Number)type.getMethod("getBalance",OfflinePlayer.class).invoke(economy,a)).doubleValue();}
 void setBalance(Object economy,Class<?> type,double target)throws Exception{
  double delta=target-balance(economy,type);if(Math.abs(delta)<0.000001)return;Object response=type.getMethod(delta>0?"depositPlayer":"withdrawPlayer",OfflinePlayer.class,double.class).invoke(economy,a,Math.abs(delta));check((boolean)call(response,"transactionSuccess"),"test player Vault balance fixture adjusted");
 }
 void vault()throws Exception{
  if(!Bukkit.getPluginManager().isPluginEnabled("Vault")){evidence.add("SKIP Vault: plugin unavailable");return;}
  Class<?> type=Class.forName("net.milkbowl.vault.economy.Economy");var registration=Bukkit.getServicesManager().getRegistration(type);if(registration==null){evidence.add("SKIP Vault: no registered real economy provider");return;}
  Object economy=registration.getProvider();double original=balance(economy,type);Definitions definitions=system.definitions;
  check(Bukkit.getPluginManager().isPluginEnabled("Essentials"),"real EssentialsX money provider plugin loaded");check(String.valueOf(call(economy,"getName")).toLowerCase(Locale.ROOT).contains("essentials"),"Vault service is real Essentials economy");
  try{
   YamlConfiguration yaml=new YamlConfiguration();yaml.loadFromString(definitions.yaml.saveToString());yaml.set("economy","vault");system.definitions=Definitions.parse(yaml.saveToString());system.dialogue.clear();a.getInventory().clear();at(a,"merchant");setBalance(economy,type,10);
   var good=Definitions.section(system.definitions.shops.get("market").getMapList("goods").get(0));Material material=Definitions.material(good.getString("material"));int quantity=good.getInt("amount",1);double buy=good.getDouble("buy"),sell=good.getDouble("sell");
   system.dialogue.shop(a,"merchant","market");String token=menuToken(a);system.dialogue.choose(a,token,0);check(count(a,material)==quantity&&Math.abs(balance(economy,type)-(10-buy))<0.000001,"real Vault shop buy debits Essentials and delivers goods");
   system.dialogue.choose(a,menuToken(a),1);check(count(a,material)==0&&Math.abs(balance(economy,type)-(10-buy+sell))<0.000001,"real Vault shop sell credits Essentials and removes goods");
   double before=balance(economy,type);system.dialogue.choose(a,menuToken(a),1);check(Math.abs(balance(economy,type)-before)<0.000001,"Vault sell with missing goods leaves balance unchanged");
   setBalance(economy,type,0);system.dialogue.choose(a,menuToken(a),0);check(count(a,material)==0&&Math.abs(balance(economy,type))<0.000001,"real Vault insufficient balance rejects purchase");
   setBalance(economy,type,10);for(int i=0;i<36;i++)a.getInventory().setItem(i,new ItemStack(Material.COBBLESTONE,64));system.dialogue.choose(a,menuToken(a),0);check(Math.abs(balance(economy,type)-10)<0.000001&&count(a,material)==0,"real Vault full inventory preflight preserves funds");
   a.getInventory().clear();ready("welcome",system.definitions.quests.get("welcome").getMapList("stages").size());system.progress.set(a.getUniqueId(),"quests.welcome.claim-pending",false);double reward=0;for(Map<?,?> raw:system.definitions.quests.get("welcome").getMapList("rewards")){var action=Definitions.section(raw);if(action.getString("type","").equals("money"))reward+=action.getDouble("amount");}
   check(system.claimQuest(a,"welcome"),"real Vault quest claim succeeds");check(Math.abs(balance(economy,type)-(10+reward))<0.000001,"real Vault quest deposit reaches Essentials balance");check(!system.claimQuest(a,"welcome")&&Math.abs(balance(economy,type)-(10+reward))<0.000001,"duplicate Vault reward claim does not credit again");
  }finally{system.definitions=definitions;system.dialogue.clear();setBalance(economy,type,original);}
 }
 void integrations(CommandSender sender)throws Exception{
  assertions=0;evidence.clear();Fixture fixture=new Fixture();Object[] citizen={null};Runnable cleanup=()->{try{if(citizen[0]!=null){system.integrations.destroyCitizen(citizen[0]);citizen[0]=null;}fixture.close();}catch(Exception error){throw new IllegalStateException("Verifier fixture restoration failed",error);}};pendingCleanup=cleanup;
  try{
   if(Bukkit.getPluginManager().isPluginEnabled("PlaceholderAPI")){String expected=String.valueOf(system.isCompleted(a,"lighthouse"));check(system.integrations.placeholders(a,"%npcs_completed_lighthouse%").equals(expected),"real PAPI registered completion placeholder");check(system.integrations.placeholders(a,"%npcs_stage_welcome%").equals(String.valueOf(system.quests.stage(a,"welcome"))),"real PAPI stage placeholder");}else evidence.add("SKIP PlaceholderAPI: plugin unavailable");
   worldGuard();vault();
   if(!Bukkit.getPluginManager().isPluginEnabled("Citizens")){evidence.add("SKIP Citizens: plugin unavailable or disabled");cleanup.run();pendingCleanup=null;report("integrations",sender);return;}
   Object registry=Class.forName("net.citizensnpcs.api.CitizensAPI").getMethod("getNPCRegistry").invoke(null);Set<UUID> original=new HashSet<>();for(Object npc:(Iterable<?>)registry)original.add((UUID)call(npc,"getUniqueId"));
   Location spawn=new Location(Bukkit.getWorld("npc_demo"),0.5,65,5.5);Location target=spawn.clone().add(4,0,0);citizen[0]=system.integrations.spawnCitizen("npc_verifier_"+UUID.randomUUID(),"Verifier navigation",EntityType.VILLAGER,spawn,"");Entity entity=system.integrations.citizenEntity(citizen[0]);check(entity!=null&&entity.isValid(),"real Citizens registry spawned NPC entity");check((boolean)call(citizen[0],"isProtected"),"Citizens adapter sets protected state");
   UUID unique=(UUID)call(citizen[0],"getUniqueId");Object metadata=call(citizen[0],"data");check((boolean)call(metadata,"has",new Class[]{String.class},"minecraft-npc-system"),"Citizens persistent ownership metadata exists");system.integrations.navigate(citizen[0],target);Object navigator=call(citizen[0],"getNavigator");check((boolean)call(navigator,"isNavigating"),"real Citizens navigator accepts location target");check(((Location)call(navigator,"getTargetAsLocation")).distanceSquared(target)<0.001,"Citizens navigator retains requested target");
   sender.sendMessage("NPC_VERIFY_STARTED integrations: awaiting Citizens movement for 40 server ticks");
   Bukkit.getScheduler().runTaskLater(this,()->{
    try{check(entity.isValid()&&entity.getLocation().distanceSquared(spawn)>0.04,"actual Citizens NPC moved along navigation path");system.integrations.destroyCitizen(citizen[0]);citizen[0]=null;check(!entity.isValid(),"Citizens destroy removes live entity");Set<UUID> after=new HashSet<>();for(Object npc:(Iterable<?>)registry)after.add((UUID)call(npc,"getUniqueId"));check(!after.contains(unique)&&after.equals(original),"Citizens registry cleanup preserves all preexisting NPCs");cleanup.run();pendingCleanup=null;report("integrations",sender);}catch(Throwable error){try{cleanup.run();}catch(Throwable restore){error.addSuppressed(restore);}pendingCleanup=null;failed(sender,error);}
   },40);
  }catch(Throwable error){try{cleanup.run();}catch(Throwable restore){error.addSuppressed(restore);}pendingCleanup=null;if(error instanceof Exception exception)throw exception;throw new RuntimeException(error);}
 }
 void save(String phase)throws Exception{Files.createDirectories(getDataFolder().toPath());Files.writeString(getDataFolder().toPath().resolve(phase+".txt"),String.join("\n",evidence)+"\nASSERTIONS="+assertions);}
}

