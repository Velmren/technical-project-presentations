import dev.velmren.npc.DemoWorld;
import java.lang.reflect.*;
import java.util.*;
import org.bukkit.*;
import org.bukkit.block.*;
import org.bukkit.block.data.*;
import org.bukkit.block.data.type.*;
public class GeometryProbe {
 static final Map<Long,Material> cells=new HashMap<>();
 static long key(int x,int y,int z){return ((long)(x+128)<<16)|((long)(z+128)<<8)|y;}
 static Material at(int x,int y,int z){return cells.getOrDefault(key(x,y,z),Material.AIR);}
 static Object defaults(Class<?> c){if(c==boolean.class)return false;if(c==int.class)return 0;if(c==double.class)return 0d;if(c==float.class)return 0f;if(c==long.class)return 0L;if(c==byte.class)return (byte)0;if(c==short.class)return (short)0;return null;}
 static Block block(int x,int y,int z){return (Block)Proxy.newProxyInstance(Block.class.getClassLoader(),new Class[]{Block.class},(p,m,a)->{
  switch(m.getName()){
   case "setType": if(a[0]==Material.AIR)cells.remove(key(x,y,z));else cells.put(key(x,y,z),(Material)a[0]);return null;
   case "getType":return at(x,y,z);
   case "getBlockData":return Proxy.newProxyInstance(BlockData.class.getClassLoader(),new Class[]{Directional.class,Orientable.class,Leaves.class,Ageable.class,Farmland.class},(p2,m2,a2)->{
    if(m2.getName().startsWith("getMaximum"))return 7;
    return defaults(m2.getReturnType());
   });
   case "getState": return null;
  }return defaults(m.getReturnType());
 });}
 public static void main(String[] args)throws Exception{
  World world=(World)Proxy.newProxyInstance(World.class.getClassLoader(),new Class[]{World.class},(p,m,a)->{
   if(m.getName().equals("getBlockAt"))return block((Integer)a[0],(Integer)a[1],(Integer)a[2]);
   if(m.getName().equals("getName"))return "npc_demo";
   return defaults(m.getReturnType());
  });
  Constructor<?> ctor=DemoWorld.class.getDeclaredConstructor(World.class);ctor.setAccessible(true);
  Object builder=ctor.newInstance(world);Method build=DemoWorld.class.getDeclaredMethod("buildScene");build.setAccessible(true);build.invoke(builder);
  for(String id:List.of("elder","lumberjack","smith","merchant","keeper","farmer","guard","cartographer")){
   Location q=DemoWorld.landmarks(world).get(id);int x=q.getBlockX(),y=q.getBlockY(),z=q.getBlockZ();
   if(at(x,y,z)!=Material.AIR||at(x,y+1,z)!=Material.AIR||(at(x,y-1,z)==Material.AIR || at(x,y-1,z)==Material.WATER))throw new AssertionError(id+" obstructed: "+at(x,y-1,z)+","+at(x,y,z)+","+at(x,y+1,z));
   System.out.println(id+": solid ground and two clear air blocks");
  }
  int[][][] routes={{{0,0},{5,0},{5,5},{0,5},{0,0}},{{-22,-12},{-22,-8},{-26,-8},{-26,-12},{-22,-12}},{{20,-10},{24,-10},{24,-12},{20,-12},{20,-10}},{{12,12},{12,10},{18,10},{18,8},{12,8},{12,12}},{{42,10},{42,12},{42,16},{42,20},{42,16},{42,12},{42,10}},{{-20,18},{-20,23},{-20,19},{-20,18}},{{0,-26},{0,-31},{0,-27},{3,-27},{3,-26},{0,-26}},{{-12,8},{-16,8},{-16,11},{-12,11},{-12,8}}};
  for(int[][] route:routes)for(int i=1;i<route.length;i++){
   int x=route[i-1][0],z=route[i-1][1],tx=route[i][0],tz=route[i][1];
   while(true){
    if(at(x,65,z)!=Material.AIR||at(x,66,z)!=Material.AIR||at(x,64,z)==Material.AIR||at(x,64,z)==Material.WATER)throw new AssertionError("Route obstructed at "+x+",65,"+z+": "+at(x,65,z));
    if(x==tx&&z==tz)break;x+=Integer.signum(tx-x);z+=Integer.signum(tz-z);
   }
  }
  System.out.println("All eight optional walking loops have unobstructed feet/head and ground.");
  if(at(42,79,10)!=Material.AIR||at(-35,66,-10)!=Material.AIR)throw new AssertionError("Repair slots are not AIR");
  if(at(42,78,8)!=Material.SCAFFOLDING||at(42,79,8)!=Material.AIR||at(42,80,8)!=Material.AIR)throw new AssertionError("Lighthouse climb exit blocked");
  System.out.println("Both repair slots AIR; scaffolding exit clear; recorded non-air cells="+cells.size());
  System.out.println("This offline proxy checks blueprint geometry only; not Minecraft runtime or visual evidence.");
 }
}
