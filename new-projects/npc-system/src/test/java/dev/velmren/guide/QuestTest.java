package dev.velmren.guide;
import java.nio.file.*;
import java.util.UUID;
public final class QuestTest{
 private static int count;
 private static void check(boolean ok,String name){count++;if(!ok)throw new AssertionError(name);}
 public static void main(String[] args)throws Exception{
  Path dir=Files.createTempDirectory("harbor-test"),file=dir.resolve("progress.properties");
  UUID a=UUID.randomUUID(),b=UUID.randomUUID();QuestStore store=new QuestStore(file);Quest q=store.get(a);
  for(String action:new String[]{"offer","inspect","claim","unknown"})check(q.apply(action).equals(q),"guard "+action);
  q=q.apply("accept");check(q.stage()==Quest.Stage.SUPPLY,"accept");check(q.apply("accept").equals(q),"duplicate accept");
  q=q.apply("offer");store.save(a,q);check(new QuestStore(file).get(a).equals(q),"partial survives restart");
  check(store.get(b).equals(Quest.fresh()),"player isolation");
  q=q.apply("offer");check(q.apply("inspect").equals(q),"inspection needs three");
  q=q.apply("offer");check(q.stage()==Quest.Stage.INSPECTION&&q.copper()==3,"three ingots");
  check(q.apply("offer").equals(q)&&q.apply("claim").equals(q),"no extra resource or early claim");
  q=q.apply("inspect");check(q.stage()==Quest.Stage.RETURN,"inspection");
  store.save(a,q);check(new QuestStore(file).get(a).equals(q),"reward ready survives restart");
  q=q.apply("claim");check(q.stage()==Quest.Stage.COMPLETE&&q.apply("claim").equals(q),"claim once");
  store.save(a,q);check(new QuestStore(file).get(a).apply("claim").equals(q),"no repeat after restart");
  for(Quest.Stage s:Quest.Stage.values()){Quest x=new Quest(s,s==Quest.Stage.NEW?0:s==Quest.Stage.SUPPLY?2:3);check(Quest.decode(x.encode()).equals(x),"roundtrip "+s);}
  for(String bad:new String[]{"NEW:3","SUPPLY:3","COMPLETE:0","BOGUS:2","NEW:-1","NEW:0:1"}){
   boolean rejected=false;try{Quest.decode(bad);}catch(IllegalArgumentException e){rejected=true;}check(rejected,"reject "+bad);
  }
  store.save(a,Quest.fresh());check(new QuestStore(file).get(a).equals(Quest.fresh()),"durable reset");
  Path blocked=dir.resolve("blocked");Files.createDirectory(blocked);QuestStore failing=new QuestStore(blocked.resolve("file"));
  Files.delete(blocked);Files.writeString(blocked,"not a directory");
  boolean failed=false;try{failing.save(a,q);}catch(java.io.IOException e){failed=true;}
  check(failed&&failing.get(a).equals(Quest.fresh()),"failed write no memory commit");
  Files.writeString(file,a+"=COMPLETE:0");boolean corrupt=false;try{new QuestStore(file);}catch(java.io.IOException e){corrupt=true;}
  check(corrupt,"corrupt file fails closed");
  System.out.println("PASS "+count+" checks: guards, bounded resources, UUID isolation, atomic save, restarts, duplicate reward, reset, corruption, IO failure");
  try(var paths=Files.walk(dir)){for(Path p:paths.sorted(java.util.Comparator.reverseOrder()).toList())Files.delete(p);}
 }
}
