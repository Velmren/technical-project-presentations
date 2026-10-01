package dev.velmren.guide;
import java.io.*;
import java.nio.channels.FileChannel;
import java.nio.file.*;
import java.util.*;
/** Single server-thread owner. Failed writes never update in-memory state. */
public final class QuestStore {
 private final Path file;
 private final Map<UUID,Quest> quests=new HashMap<>();
 public QuestStore(Path file)throws IOException{
  this.file=file;if(!Files.exists(file))return;
  Properties p=new Properties();try(Reader r=Files.newBufferedReader(file)){p.load(r);}
  try{for(String k:p.stringPropertyNames())quests.put(UUID.fromString(k),Quest.decode(p.getProperty(k)));}
  catch(IllegalArgumentException e){throw new IOException("Corrupt progress: refusing to reset player progress",e);}
 }
 public Quest get(UUID id){return quests.getOrDefault(id,Quest.fresh());}
 public void save(UUID id,Quest next)throws IOException{
  Map<UUID,Quest> draft=new HashMap<>(quests);draft.put(id,next);
  Files.createDirectories(file.toAbsolutePath().getParent());
  Path temp=file.resolveSibling(file.getFileName()+".tmp");
  Properties p=new Properties();draft.forEach((key,q)->p.setProperty(key.toString(),q.encode()));
  try{
   try(Writer w=Files.newBufferedWriter(temp)){p.store(w,"North Harbor / schema 1");}
   try(FileChannel c=FileChannel.open(temp,StandardOpenOption.WRITE)){c.force(true);}
   Files.move(temp,file,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);
   quests.clear();quests.putAll(draft);
  }finally{Files.deleteIfExists(temp);}
 }
}
