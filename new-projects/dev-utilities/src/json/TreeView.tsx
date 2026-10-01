import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { TreeNode } from "../json-core";
import { useI18n } from "../i18n";
import { ROW, useWindow } from "../ui/useWindow";

export { ROW, useWindow };

type Props = {
  nodes: TreeNode[];
  expanded: Set<string>;
  flat: boolean;
  selectedPath: string | null;
  onToggle: (path: string) => void;
  onSelect: (node: TreeNode, focusEditor: boolean) => void;
};

export function valueClass(type: string) {
  return "v-" + type;
}

export function Summary({
  type,
  children,
}: {
  type: string;
  children: number;
}) {
  const { t } = useI18n();
  if (type === "object")
    return (
      <span className="v-summary">
        {"{ " + t("json.summary.object", { count: children }) + " }"}
      </span>
    );
  return (
    <span className="v-summary">
      {"[ " + t("json.summary.array", { count: children }) + " ]"}
    </span>
  );
}

export function TreeView({
  nodes,
  expanded,
  flat,
  selectedPath,
  onToggle,
  onSelect,
}: Props) {
  const { t } = useI18n();
  const types = useMemo(
    () => new Map(nodes.map((n) => [n.id, n.type])),
    [nodes],
  );
  const visible = useMemo(() => {
    if (flat) return nodes;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    return nodes.filter((node) => {
      let parent = byId.get(node.parent);
      while (parent) {
        if (!expanded.has(parent.path)) return false;
        parent = byId.get(parent.parent);
      }
      return true;
    });
  }, [nodes, expanded, flat]);
  const [active, setActive] = useState(0);
  const { box, first, last, reveal } = useWindow(visible.length);

  useEffect(() => {
    if (selectedPath === null) return;
    const index = visible.findIndex((n) => n.path === selectedPath);
    if (index >= 0) setActive(index);
  }, [selectedPath, visible]);
  const current = Math.min(active, Math.max(0, visible.length - 1));

  function move(index: number) {
    const next = Math.max(0, Math.min(visible.length - 1, index));
    setActive(next);
    reveal(next);
    onSelect(visible[next], false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const node = visible[current];
    if (!node) return;
    const open = expanded.has(node.path);
    const page = Math.max(
      1,
      Math.floor((box.current?.clientHeight || 240) / ROW) - 1,
    );
    if (e.key === "ArrowDown") move(current + 1);
    else if (e.key === "ArrowUp") move(current - 1);
    else if (e.key === "PageDown") move(current + page);
    else if (e.key === "PageUp") move(current - page);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(visible.length - 1);
    else if (e.key === "ArrowRight" && !flat && node.children) {
      if (!open) onToggle(node.path);
      else move(current + 1);
    } else if (e.key === "ArrowLeft" && !flat) {
      if (node.children && open) onToggle(node.path);
      else {
        const parent = visible.findIndex((n) => n.id === node.parent);
        if (parent >= 0) move(parent);
      }
    } else if (e.key === "Enter") onSelect(node, true);
    else return;
    e.preventDefault();
  }

  return (
    <div
      ref={box}
      className="tree"
      role="tree"
      aria-label={t("json.tree.label")}
      tabIndex={0}
      aria-activedescendant={
        visible[current] ? `tree-row-${visible[current].id}` : undefined
      }
      onKeyDown={onKeyDown}
    >
      <div style={{ height: visible.length * ROW, position: "relative" }}>
        {visible.slice(first, last).map((node, i) => {
          const index = first + i;
          const isOpen = expanded.has(node.path);
          const container = node.type === "object" || node.type === "array";
          return (
            <div
              key={node.id}
              id={`tree-row-${node.id}`}
              role="treeitem"
              aria-level={node.depth + 1}
              aria-expanded={!flat && node.children ? isOpen : undefined}
              aria-selected={selectedPath === node.path}
              className={
                "tree-row" +
                (selectedPath === node.path ? " selected" : "") +
                (index === current ? " active" : "")
              }
              style={{
                top: index * ROW,
                paddingLeft: 6 + (flat ? 0 : Math.min(node.depth, 24) * 14),
              }}
              onClick={() => {
                setActive(index);
                onSelect(node, false);
              }}
            >
              {!flat && (
                <button
                  type="button"
                  tabIndex={-1}
                  className="tree-toggle"
                  aria-label={t("json.tree.toggle", {
                    path: node.path || t("common.root"),
                  })}
                  disabled={!node.children}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(node.path);
                  }}
                >
                  {node.children > 0 && (
                    <ChevronRight size={13} className={isOpen ? "open" : ""} />
                  )}
                </button>
              )}
              <span
                className={
                  "tree-key" +
                  (flat
                    ? " is-path"
                    : types.get(node.parent) === "array"
                      ? " is-index"
                      : "")
                }
              >
                {flat ? node.path || "$" : node.parent < 0 ? "$" : node.key}
              </span>
              {container ? (
                <Summary type={node.type} children={node.children} />
              ) : (
                <span className={"tree-value " + valueClass(node.type)}>
                  {node.preview}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
