package dev.velmren.npc;

import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.block.Sign;
import org.bukkit.block.data.BlockData;
import org.bukkit.block.data.Directional;
import org.bukkit.block.data.Orientable;
import org.bukkit.block.data.type.Leaves;
import org.bukkit.block.data.Ageable;
import org.bukkit.block.data.type.Farmland;
import org.bukkit.block.BlockFace;
import org.bukkit.Axis;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/** Deterministic, dependency-free block blueprint for the dedicated npc_demo world. */
public final class DemoWorld {
    public static final String WORLD_NAME = "npc_demo";
    private final World w;
    private DemoWorld(World world) { this.w = world; }

    /** Explicit installation only. Rebuilding resets the demo terrain and its repair props. */
    public static Location build(World world) {
        if (world == null || !WORLD_NAME.equals(world.getName()))
            throw new IllegalArgumentException("Demo installation is restricted to world npc_demo");
        if (!Bukkit.isPrimaryThread()) throw new IllegalStateException("Build on the server main thread");
        new DemoWorld(world).buildScene();
        Location spawn = new Location(world, 0.5, 65, 7.5, 180, 0);
        world.setSpawnLocation(spawn);
        world.setTime(1000);
        world.setStorm(false);
        world.setThundering(false);
        return spawn;
    }

    public static Map<String, Location> landmarks(World world) {
        Map<String, Location> m = new LinkedHashMap<>();
        point(m, world, "elder", 0,65,0);
        point(m, world, "lumberjack", -22,65,-12);
        point(m, world, "smith", 20,65,-10);
        point(m, world, "merchant", 12,65,12);
        point(m, world, "keeper", 42,65,10);
        point(m, world, "farmer", -20,65,18);
        point(m, world, "guard", 0,65,-26);
        point(m, world, "cartographer", -12,65,8);
        point(m, world, "lighthouse_repair", 42,79,10);
        point(m, world, "mill_repair", -35,66,-10);
        point(m, world, "harbor", 0,65,32);
        point(m, world, "ship", 14,65,55);
        point(m, world, "overview_camera", -45,89,56);
        point(m, world, "square_camera", 5,69,22);
        return Collections.unmodifiableMap(m);
    }
    private static void point(Map<String,Location> m, World w, String id, int x,int y,int z) {
        m.put(id, new Location(w,x,y,z));
    }
    private void b(int x,int y,int z,Material m) { w.getBlockAt(x,y,z).setType(m,false); }
    private void box(int x1,int y1,int z1,int x2,int y2,int z2,Material m) {
        for(int x=x1;x<=x2;x++) for(int z=z1;z<=z2;z++) for(int y=y1;y<=y2;y++) b(x,y,z,m);
    }
    private void direction(int x,int y,int z,Material m,BlockFace face) {
        b(x,y,z,m); Block q=w.getBlockAt(x,y,z); BlockData d=q.getBlockData();
        if(d instanceof Directional) { ((Directional)d).setFacing(face); q.setBlockData(d,false); }
    }
    private void log(int x,int y,int z,Material m,Axis axis) {
        b(x,y,z,m); Block q=w.getBlockAt(x,y,z); BlockData d=q.getBlockData();
        if(d instanceof Orientable) { ((Orientable)d).setAxis(axis); q.setBlockData(d,false); }
    }
    private void sign(int x,int y,int z,String a,String c) {
        direction(x,y,z,Material.OAK_SIGN,BlockFace.SOUTH);
        if(w.getBlockAt(x,y,z).getState() instanceof Sign) {
            Sign s=(Sign)w.getBlockAt(x,y,z).getState();
            s.setLine(0,a); s.setLine(1,c); s.update(true,false);
        }
    }
    private void buildScene() {
        // A complete bounded replacement volume, visited by column to avoid chunk thrashing.
        for(int x=-88;x<=88;x++) for(int z=-78;z<=82;z++) {
            for(int y=65;y<=106;y++) b(x,y,z,Material.AIR);
            b(x,59,z,Material.STONE); b(x,60,z,Material.GRAVEL);
            box(x,61,z,x,63,z,Material.WATER);
            boolean land = x>=-61 && x<=55 && z>=-51 && z<=32;
            // Stepped southern shoreline and eastern cape.
            if(z>27 && (x< -39 || (x>30 && x<37))) land=false;
            if(land) {
                box(x,61,z,x,63,z,Material.STONE);
                b(x,64,z,(z>=29 || x>=53 || x<=-59)?Material.SAND:Material.GRASS_BLOCK);
            } else b(x,64,z,Material.AIR);
        }
        // Broad avenues joining all eight interactable characters.
        path(-3,-35,3,31); path(-44,-13,43,-9); path(-25,7,44,11);
        path(-23,-13,-19,26); path(18,-20,22,15);
        box(-10,64,-8,10,64,9,Material.STONE_BRICKS);
        for(int x=-9;x<=9;x++) for(int z=-7;z<=8;z++)
            if((x+z)%5==0) b(x,64,z,Material.ANDESITE);
        // Fountain at north edge leaves the elder's central standing place clear.
        box(-3,65,-6,3,65,-2,Material.STONE_BRICK_SLAB);
        box(-2,65,-5,2,65,-3,Material.WATER);
        box(0,65,-4,0,68,-4,Material.CHISELED_STONE_BRICKS);
        b(0,69,-4,Material.WATER);
        box(-1,66,-4,-1,68,-4,Material.WATER); box(1,66,-4,1,68,-4,Material.WATER);
        b(-1,69,-4,Material.WATER); b(1,69,-4,Material.WATER);
        bench(-7,3); bench(6,3); lamp(-9,-8);lamp(9,-8);lamp(-9,8);lamp(9,8);
        sign(-6,65,7,"TIDEHAVEN","Village square");
        house(-29,-25,11,10,Material.WHITE_TERRACOTTA,Material.SPRUCE_PLANKS,"WOODCUTTER");
        woodYard();
        house(15,-26,11,12,Material.STONE_BRICKS,Material.DARK_OAK_PLANKS,"FORGE");
        forge();
        house(-17,13,10,9,Material.WHITE_TERRACOTTA,Material.DARK_OAK_PLANKS,"CHART HOUSE");
        mapHouse();
        house(-34,24,11,9,Material.YELLOW_TERRACOTTA,Material.SPRUCE_PLANKS,"FARMSTEAD");
        farm();
        market(); mill(); lighthouse(); harbor(); ship(14,55); ship(-25,61);
        box(-26,64,45,-24,64,50,Material.SPRUCE_PLANKS);
        garden();
        // Forest margins have a continuous clear trail around the lumber camp.
        int[][] trees={{-54,-37},{-44,-35},{-35,-40},{-56,-21},{-52,-5},{-49,10},
            {-52,24},{-43,21},{-41,1},{-34,-3},{-30,-35},{-22,-40},
            {31,-36},{43,-40},{51,-26},{49,-9},{35,-4},{51,24}};
        for(int i=0;i<trees.length;i++) tree(trees[i][0],trees[i][1],i%3==0);
        gate(); castle();
        for(int[] p:new int[][]{{-20,-9},{20,-9},{-22,18},{12,9},{35,9},{0,21},{-12,9}}) lamp(p[0]+3,p[1]+3);
        // Walking repair target: visibly absent spoke; quest replaces with OAK_PLANKS.
        b(-35,66,-10,Material.AIR);
        // Top lantern repair target is intentionally absent.
        b(42,79,10,Material.AIR);
        sign(39,65,15,"LIGHTHOUSE","Restore the lamp");
        sign(-34,65,-5,"OLD MILL","Repair the wheel");
    }
    private void garden() {
        // Small intentionally placed details keep the walking avenues completely unobstructed.
        int[][] blooms={{-8,13},{-7,14},{-5,16},{-8,18},{30,4},{31,5},{32,3},
            {34,17},{34,19},{36,21},{-47,25},{-46,27},{-48,29},{-14,-23},{-13,-24},
            {47,-16},{48,-18},{46,-19},{-54,-28},{-52,-30},{-50,-28}};
        for(int i=0;i<blooms.length;i++) {
            int x=blooms[i][0],z=blooms[i][1];
            if(w.getBlockAt(x,64,z).getType()==Material.GRASS_BLOCK && w.getBlockAt(x,65,z).getType()==Material.AIR)
                b(x,65,z,i%3==0?Material.POPPY:(i%3==1?Material.DANDELION:Material.BLUE_ORCHID));
        }
        for(int[] p:new int[][]{{-11,-2},{11,-2},{-17,-31},{12,-31},{30,12},{37,26},{-48,3}}) {
            b(p[0],65,p[1],Material.OAK_LEAVES);
            Leaves d=(Leaves)w.getBlockAt(p[0],65,p[1]).getBlockData(); d.setPersistent(true);w.getBlockAt(p[0],65,p[1]).setBlockData(d,false);
        }
        // Warehouse on the waterfront: open loading arch, stacked cargo, weathered walls.
        house(-24,33,10,8,Material.BROWN_TERRACOTTA,Material.DARK_OAK_PLANKS,"HARBOR STORE");
        box(-21,65,40,-18,67,40,Material.AIR);
        box(-23,65,34,-22,66,36,Material.BARREL);
        box(-17,65,34,-16,65,37,Material.HAY_BLOCK);
        b(-18,65,36,Material.CHEST);
        box(-21,64,41,-18,64,45,Material.SPRUCE_PLANKS);
    }
    private void path(int x1,int z1,int x2,int z2) { box(x1,64,z1,x2,64,z2,Material.GRAVEL); }
    private void lamp(int x,int z) {
        box(x,65,z,x,68,z,Material.SPRUCE_FENCE); b(x,69,z,Material.LANTERN);
        b(x,70,z,Material.SPRUCE_SLAB);
    }
    private void bench(int x,int z) {
        for(int i=0;i<3;i++) { direction(x+i,65,z,Material.SPRUCE_STAIRS,BlockFace.NORTH); b(x+i,65,z-1,Material.OAK_TRAPDOOR); }
    }
    private void house(int x,int z,int width,int depth,Material wall,Material roof,String title) {
        box(x,64,z,x+width-1,64,z+depth-1,Material.COBBLESTONE);
        box(x,65,z,x+width-1,68,z+depth-1,wall);
        box(x+1,65,z+1,x+width-2,68,z+depth-2,Material.AIR);
        box(x+1,64,z+1,x+width-2,64,z+depth-2,Material.OAK_PLANKS);
        for(int px:new int[]{x,x+width-1}) for(int pz:new int[]{z,z+depth-1}) box(px,65,pz,px,69,pz,Material.STRIPPED_SPRUCE_LOG);
        int cx=x+width/2;
        box(cx,65,z+depth-1,cx,66,z+depth-1,Material.AIR);
        for(int px:new int[]{x+2,x+width-3}) {
            box(px,66,z+depth-1,px+1,67,z+depth-1,Material.GLASS_PANE);
            box(px,66,z,px+1,67,z,Material.GLASS_PANE);
            b(px,65,z+depth,Material.GRASS_BLOCK); b(px,66,z+depth,Material.POPPY);
        }
        for(int pz=z+2;pz<z+depth-2;pz+=3) { b(x,66,pz,Material.GLASS_PANE); b(x+width-1,66,pz,Material.GLASS_PANE); }
        for(int layer=0;layer<=(width+1)/2;layer++) {
            int lx=x-1+layer, rx=x+width-layer;
            if(lx>rx) break;
            box(lx,69+layer,z-1,lx,69+layer,z+depth,roof);
            box(rx,69+layer,z-1,rx,69+layer,z+depth,roof);
            if(lx<rx) { box(lx+1,69+layer,z,rx-1,69+layer,z,wall); box(lx+1,69+layer,z+depth-1,rx-1,69+layer,z+depth-1,wall); }
        }
        box(x+2,69,z+2,x+3,76,z+3,Material.BRICKS); b(x+2,77,z+2,Material.CAMPFIRE);
        b(x+2,65,z+2,Material.CRAFTING_TABLE);b(x+3,65,z+2,Material.BARREL);
        b(x+width-3,65,z+2,Material.CHEST);
        box(x+width-4,65,z+depth-3,x+width-3,65,z+depth-3,Material.RED_WOOL);
        box(x+width-4,66,z+depth-3,x+width-3,66,z+depth-3,Material.RED_CARPET);
        b(cx,68,z+depth-3,Material.LANTERN);
        sign(cx-2,65,z+depth+1,title,"Welcome inside");
    }
    private void woodYard() {
        for(int z=-20;z<=-17;z+=2) for(int y=65;y<=66;y++) for(int x=-36;x<=-31;x++) log(x,y,z,Material.SPRUCE_LOG,Axis.X);
        b(-24,65,-15,Material.CRAFTING_TABLE); b(-23,65,-15,Material.BARREL);
        for(int x=-29;x<=-18;x++) b(x,65,-28,Material.SPRUCE_FENCE);
    }
    private void forge() {
        box(27,64,-24,32,64,-15,Material.COBBLESTONE);
        box(29,65,-23,31,68,-21,Material.BRICKS);b(30,65,-20,Material.FURNACE);
        box(30,69,-22,30,75,-22,Material.BRICKS);b(30,76,-22,Material.CAMPFIRE);
        b(28,65,-17,Material.ANVIL);b(30,65,-16,Material.SMITHING_TABLE);
        box(27,70,-24,32,70,-15,Material.DARK_OAK_SLAB);
        for(int x:new int[]{27,32}) for(int z:new int[]{-24,-15}) box(x,65,z,x,69,z,Material.DARK_OAK_FENCE);
        b(28,65,-20,Material.CAULDRON);
    }
    private void mapHouse() {
        box(-16,65,14,-16,67,19,Material.BOOKSHELF);
        b(-13,65,15,Material.CARTOGRAPHY_TABLE); b(-11,65,15,Material.LECTERN);
        box(-13,65,18,-11,65,19,Material.OAK_SLAB);
        box(-13,66,18,-11,66,19,Material.LIGHT_BLUE_CARPET);
    }
    private void farm() {
        for(int x=-42;x<=-24;x++) for(int z=13;z<=21;z++) {
            if(x%5==0) b(x,64,z,Material.WATER);
            else {
                b(x,64,z,Material.FARMLAND); Farmland soil=(Farmland)w.getBlockAt(x,64,z).getBlockData(); soil.setMoisture(soil.getMaximumMoisture()); w.getBlockAt(x,64,z).setBlockData(soil,false);
                b(x,65,z,Material.WHEAT); Ageable crop=(Ageable)w.getBlockAt(x,65,z).getBlockData(); crop.setAge(crop.getMaximumAge()); w.getBlockAt(x,65,z).setBlockData(crop,false);
            }
        }
        for(int x=-43;x<=-24;x++) {b(x,65,12,Material.OAK_FENCE);b(x,65,22,Material.OAK_FENCE);}
        for(int z=12;z<=22;z++) b(-43,65,z,Material.OAK_FENCE);
        box(-39,65,26,-36,66,29,Material.HAY_BLOCK);
        box(-29,65,20,-29,66,20,Material.OAK_FENCE); b(-29,67,20,Material.CARVED_PUMPKIN);
        log(-30,66,20,Material.OAK_LOG,Axis.X);log(-28,66,20,Material.OAK_LOG,Axis.X);
    }
    private void market() {
        stall(11,16,Material.RED_WOOL);stall(22,16,Material.BLUE_WOOL);
        stall(11,25,Material.YELLOW_WOOL);stall(22,25,Material.GREEN_WOOL);
        box(7,64,14,29,64,30,Material.COBBLESTONE);
        for(int x=8;x<=28;x++) if(x%4==0) b(x,64,22,Material.MOSSY_COBBLESTONE);
        sign(9,65,13,"HARBOR MARKET","Emerald trading");
    }
    private void stall(int x,int z,Material color) {
        for(int px:new int[]{x,x+5}) for(int pz:new int[]{z,z+4}) box(px,65,pz,px,68,pz,Material.OAK_FENCE);
        for(int px=x-1;px<=x+6;px++) box(px,69,z-1,px,69,z+5,(px%2==0)?color:Material.WHITE_WOOL);
        box(x+1,65,z+3,x+4,65,z+3,Material.BARREL);
        b(x+1,66,z+3,Material.MELON);b(x+3,66,z+3,Material.PUMPKIN);
        b(x+4,68,z+1,Material.LANTERN);
    }
    private void tree(int x,int z,boolean spruce) {
        Material leaves=spruce?Material.SPRUCE_LEAVES:Material.OAK_LEAVES;
        int h=spruce?8:5;
        box(x,65,z,x,65+h,z,spruce?Material.SPRUCE_LOG:Material.OAK_LOG);
        for(int y=68;y<=65+h+2;y++) {
            int r=spruce?Math.max(1,3-(y-68)/3):(y>70?2:3);
            for(int dx=-r;dx<=r;dx++) for(int dz=-r;dz<=r;dz++) if(Math.abs(dx)+Math.abs(dz)<=r+1 && (dx!=0 || dz!=0 || y>65+h)) {
                b(x+dx,y,z+dz,leaves);
                Block q=w.getBlockAt(x+dx,y,z+dz);Leaves d=(Leaves)q.getBlockData();d.setPersistent(true);q.setBlockData(d,false);
            }
        }
    }
    private void mill() {
        house(-46,-19,10,12,Material.WHITE_TERRACOTTA,Material.SPRUCE_PLANKS,"OLD MILL");
        box(-35,64,-15,-33,64,-5,Material.WATER);
        for(int dz=-3;dz<=3;dz++) for(int dy=-3;dy<=3;dy++) {
            int r=dz*dz+dy*dy;
            if(r>=7 && r<=13) b(-35,68+dy,-10+dz,Material.SPRUCE_PLANKS);
            if(dz==0 || dy==0) b(-35,68+dy,-10+dz,Material.OAK_PLANKS);
        }
        log(-36,68,-10,Material.OAK_LOG,Axis.X);
        box(-36,65,-6,-32,65,-4,Material.OAK_SLAB);
    }
    private void lighthouse() {
        for(int y=65;y<=77;y++) for(int dx=-3;dx<=3;dx++) for(int dz=-3;dz<=3;dz++) {
            int r=dx*dx+dz*dz;
            if(r<=10 && r>=5) b(42+dx,y,10+dz,(y==70||y==71)?Material.RED_CONCRETE:Material.WHITE_CONCRETE);
        }
        box(41,65,12,43,67,13,Material.AIR);
        box(38,78,6,46,78,14,Material.STONE_BRICK_SLAB);
        for(int dx=-3;dx<=3;dx++) for(int dz=-3;dz<=3;dz++) if(Math.abs(dx)==3 || Math.abs(dz)==3) box(42+dx,79,10+dz,42+dx,81,10+dz,Material.GLASS_PANE);
        box(39,82,7,45,82,13,Material.DARK_OAK_SLAB);
        box(40,83,8,44,83,12,Material.DARK_OAK_SLAB);
        b(42,84,10,Material.LANTERN);
        for(int y=65;y<=78;y++) b(42,y,8,Material.SCAFFOLDING);
        box(40,64,13,44,64,21,Material.STONE_BRICKS);
        box(41,64,20,43,64,30,Material.GRAVEL);
    }
    private void harbor() {
        box(-35,64,31,31,64,34,Material.STONE_BRICKS);
        for(int x=-35;x<=30;x+=5) {b(x,65,33,Material.COBBLESTONE_WALL);b(x,66,33,Material.LANTERN);}
        box(-7,64,34,7,64,58,Material.SPRUCE_PLANKS);
        box(-29,64,42,6,64,45,Material.SPRUCE_PLANKS);
        box(5,64,47,22,64,50,Material.SPRUCE_PLANKS);
        for(int x:new int[]{-7,7}) for(int z=35;z<=58;z+=5) {box(x,61,z,x,65,z,Material.SPRUCE_LOG);b(x,66,z,Material.LANTERN);}
        for(int x=-28;x<=20;x+=6) for(int z:new int[]{43,49}) box(x,61,z,x,65,z,Material.SPRUCE_LOG);
        for(int x=-6;x<=-3;x++) {b(x,65,37,Material.BARREL);b(x,65,38,Material.BARREL);}
        b(5,65,40,Material.CHEST); b(-5,66,38,Material.LANTERN);
        sign(0,65,30,"TIDEHAVEN DOCKS","Ships & expeditions");
    }
    private void ship(int x,int z) {
        // Long axis north/south, pronounced bow and stern, raised bulwarks, two cloth sails.
        for(int dz=-11;dz<=11;dz++) {
            int r=Math.abs(dz)>8?1:(Math.abs(dz)>6?2:4);
            box(x-r,62,z+dz,x+r,64,z+dz,Material.DARK_OAK_PLANKS);
            if(r>1) box(x-r+1,65,z+dz,x+r-1,65,z+dz,Material.SPRUCE_PLANKS);
            b(x-r,65,z+dz,Material.DARK_OAK_FENCE);b(x+r,65,z+dz,Material.DARK_OAK_FENCE);
        }
        box(x-3,66,z+5,x+3,68,z+8,Material.SPRUCE_PLANKS);
        box(x-2,66,z+5,x+2,67,z+7,Material.AIR);
        box(x-3,69,z+5,x+3,69,z+8,Material.DARK_OAK_SLAB);
        b(x,67,z+8,Material.GLASS_PANE);b(x-2,66,z+6,Material.CHEST);
        for(int dz:new int[]{-4,3}) {
            box(x,66,z+dz,x,83,z+dz,Material.SPRUCE_LOG);
            for(int dx=-5;dx<=5;dx++) log(x+dx,81,z+dz,Material.SPRUCE_LOG,Axis.X);
            for(int y=72;y<=80;y++) for(int dx=-4;dx<=4;dx++)
                b(x+dx,y,z+dz+1,((y==76||y==77)&&Math.abs(dx)<2)?Material.BLUE_WOOL:Material.WHITE_WOOL);
            box(x+1,83,z+dz,x+4,83,z+dz,Material.RED_WOOL);
        }
        box(x,67,z-14,x,67,z-10,Material.SPRUCE_FENCE);
    }
    private void gate() {
        tower(-10,-36,5,12);tower(6,-36,5,12);
        box(-5,72,-36,5,75,-32,Material.STONE_BRICKS);
        for(int x=-5;x<=5;x+=2) b(x,76,-34,Material.STONE_BRICKS);
        for(int x=-55;x<=54;x++) if(Math.abs(x)>12) {
            box(x,65,-36,x,68,-34,Material.COBBLESTONE);
            if(x%2==0) b(x,69,-35,Material.STONE_BRICKS);
        }
        path(-3,-51,3,-27);sign(4,65,-27,"NORTH GATE","Keep the peace");
    }
    private void tower(int x,int z,int r,int height) {
        box(x,65,z,x+r-1,64+height,z+r-1,Material.STONE_BRICKS);
        box(x+1,65,z+1,x+r-2,63+height,z+r-2,Material.AIR);
        box(x,65,z+r-1,x,66,z+r-1,Material.AIR);
        for(int px=x-1;px<=x+r;px++) for(int pz=z-1;pz<=z+r;pz++) {
            b(px,65+height,pz,Material.STONE_BRICK_SLAB);
            if((px==x-1 || px==x+r || pz==z-1 || pz==z+r) && (px+pz)%2==0) b(px,66+height,pz,Material.STONE_BRICKS);
        }
        b(x+r/2,67+height,z+r/2,Material.LANTERN);
    }
    private void castle() {
        // Deliberate distant silhouettes behind the gate; inaccessible exhibit ground.
        box(20,64,-69,55,67,-48,Material.STONE);
        box(24,68,-65,51,77,-52,Material.STONE_BRICKS);
        box(26,68,-63,49,76,-54,Material.AIR);
        for(int x=24;x<=51;x+=2) b(x,78,-52,Material.STONE_BRICKS);
        towerHigh(21,-67);towerHigh(49,-67);towerHigh(21,-53);towerHigh(49,-53);
        box(33,68,-62,42,87,-55,Material.STONE_BRICKS);
        for(int y=0;y<6;y++) box(32+y,88+y,-63+y,43-y,88+y,-54-y,Material.DARK_OAK_PLANKS);
        box(37,91,-59,37,98,-59,Material.OAK_FENCE);
        box(38,96,-59,42,98,-59,Material.BLUE_WOOL);
        box(36,68,-53,39,72,-52,Material.AIR);
    }
    private void towerHigh(int x,int z) {
        box(x,68,z,x+5,85,z+5,Material.STONE_BRICKS);
        for(int y=0;y<4;y++) box(x-1+y,86+y,z-1+y,x+6-y,86+y,z+6-y,Material.DARK_OAK_PLANKS);
        b(x+2,78,z+5,Material.BLACK_STAINED_GLASS_PANE);
    }
}
