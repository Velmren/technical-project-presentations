const palettes = [
  ["#1f6fb2", "#35a7e8"],
  ["#1d7f73", "#2fc1a6"],
  ["#5a4bc2", "#8f7df0"],
  ["#9a5a1f", "#e0a14a"],
  ["#a2445a", "#e27b8f"],
  ["#2d5d8a", "#6f9fd0"],
  ["#4f6b2f", "#9cc062"],
  ["#6b3f8f", "#b27ad9"],
];

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({ name, tone = 0, size = 32 }: { name: string; tone?: number; size?: number }) {
  const [from, to] = palettes[Math.abs(tone) % palettes.length];
  return (
    <span
      className="ui-avatar"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)), background: `linear-gradient(140deg, ${from}, ${to})` }}
    >
      {initials(name)}
    </span>
  );
}
