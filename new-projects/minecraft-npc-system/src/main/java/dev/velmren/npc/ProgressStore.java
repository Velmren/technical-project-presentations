package dev.velmren.npc;

import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import org.bukkit.configuration.file.YamlConfiguration;

/** Write-through UUID snapshots. A failed write restores memory and fails the operation. */
public final class ProgressStore {
  private final Path file;
  private YamlConfiguration data;

  public ProgressStore(Path file) throws Exception {
    this.file = file;
    data = new YamlConfiguration();
    if (Files.exists(file)) data.load(file.toFile());
    validateLoadedState();
  }

  private void validateLoadedState() {
    if (!data.contains("players")) return;
    var players = data.getConfigurationSection("players");
    if (players == null) throw new IllegalArgumentException("Progress players must be a mapping");
    for (String id : players.getKeys(false)) {
      UUID.fromString(id);
      var player = players.getConfigurationSection(id);
      if (player == null) throw new IllegalArgumentException("Invalid player progress " + id);
      if (player.contains("quests") && player.getConfigurationSection("quests") == null)
        throw new IllegalArgumentException("Invalid quest state for " + id);
      var quests = player.getConfigurationSection("quests");
      if (quests == null) continue;
      for (String key : quests.getKeys(false)) {
        Definitions.key(key, "progress quest");
        var q = quests.getConfigurationSection(key);
        if (q == null) throw new IllegalArgumentException("Invalid quest progress " + key);
        for (String flag : List.of("active", "claim-pending"))
          if (q.contains(flag) && !(q.get(flag) instanceof Boolean))
            throw new IllegalArgumentException("Invalid quest flag " + flag);
        for (String n : List.of("stage", "count", "completions"))
          Definitions.number(q, n, 0, Integer.MAX_VALUE, true);
        for (String n : List.of("accepted", "last-completed"))
          Definitions.number(q, n, 0, Long.MAX_VALUE, true);
      }
    }
  }

  public synchronized String path(UUID id, String key) {
    return "players." + id + "." + key;
  }

  public synchronized int integer(UUID id, String key) {
    return data.getInt(path(id, key));
  }

  public synchronized long number(UUID id, String key) {
    return data.getLong(path(id, key));
  }

  public synchronized String string(UUID id, String key) {
    return data.getString(path(id, key), "");
  }

  public synchronized boolean flag(UUID id, String key) {
    return data.getBoolean(path(id, key));
  }

  public synchronized Object value(UUID id, String key) {
    return data.get(path(id, key));
  }

  public synchronized void change(UUID id, Map<String, Object> changes) throws Exception {
    String before = data.saveToString();
    for (var e : changes.entrySet()) data.set(path(id, e.getKey()), e.getValue());
    try {
      save();
    } catch (Exception x) {
      data = YamlConfiguration.loadConfiguration(new java.io.StringReader(before));
      throw x;
    }
  }

  public synchronized void set(UUID id, String key, Object val) throws Exception {
    Map<String, Object> m = new HashMap<>();
    m.put(key, val);
    change(id, m);
  }

  private void save() throws Exception {
    Files.createDirectories(file.toAbsolutePath().getParent());
    Path tmp = file.resolveSibling(file.getFileName() + ".tmp");
    byte[] bytes = data.saveToString().getBytes(StandardCharsets.UTF_8);
    try (var out =
        java.nio.channels.FileChannel.open(
            tmp,
            StandardOpenOption.CREATE,
            StandardOpenOption.TRUNCATE_EXISTING,
            StandardOpenOption.WRITE)) {
      var buffer = java.nio.ByteBuffer.wrap(bytes);
      while (buffer.hasRemaining()) out.write(buffer);
      out.force(true);
    }
    try {
      Files.move(tmp, file, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
    } catch (AtomicMoveNotSupportedException e) {
      Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING);
    }
  }
}
