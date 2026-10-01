package dev.velmren.guide;
/** Immutable per-player quest. */
public record Quest(Stage stage, int copper) {
 public enum Stage { NEW, SUPPLY, INSPECTION, RETURN, COMPLETE }
 public Quest {
  if(stage==null || copper<0 || copper>3 || (stage==Stage.NEW && copper!=0) ||
    (stage==Stage.SUPPLY && copper>2) || (stage.ordinal()>=Stage.INSPECTION.ordinal() && copper!=3))
   throw new IllegalArgumentException("Invalid quest snapshot");
 }
 public static Quest fresh(){return new Quest(Stage.NEW,0);}
 public Quest apply(String action){
  return switch(action){
   case "accept" -> stage==Stage.NEW ? new Quest(Stage.SUPPLY,0) : this;
   case "offer" -> stage==Stage.SUPPLY ? new Quest(copper==2?Stage.INSPECTION:Stage.SUPPLY,copper+1):this;
   case "inspect" -> stage==Stage.INSPECTION?new Quest(Stage.RETURN,3):this;
   case "claim" -> stage==Stage.RETURN?new Quest(Stage.COMPLETE,3):this;
   default -> this;
  };
 }
 public String encode(){return stage.name()+":"+copper;}
 public static Quest decode(String v){
  String[] p=v.split(":",-1);
  if(p.length!=2) throw new IllegalArgumentException("Invalid save format");
  return new Quest(Stage.valueOf(p[0]),Integer.parseInt(p[1]));
 }
}
