import { motion } from "motion/react";
import { Columns3, ListChecks, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAccess } from "../../app/access";
import { formatRoute, navigate, setQuery, type Route } from "../../app/router";
import { TODAY } from "../../data/clock";
import { CURRENT_USER, useWorkspace } from "../../data/store";
import type { Task } from "../../data/types";
import { useI18n, type Key } from "../../i18n";
import { normalize } from "../../lib/text";
import { useReduced } from "../../motion/MotionPreference";
import { fadeUp, stagger } from "../../motion/tokens";
import { Avatar } from "../../ui/Avatar";
import { Badge } from "../../ui/Badge";
import { EmptyState } from "../../ui/Blocks";
import { Button } from "../../ui/Button";
import { DataTable, type Column } from "../../ui/DataTable";
import { SearchField, Select } from "../../ui/Form";
import { Segmented } from "../../ui/Segmented";
import { NewTaskDialog } from "./NewTaskDialog";
import { TaskBoard } from "./TaskBoard";
import { DueLabel, compareTasks, dueState } from "./TaskCard";
import { TaskDrawer } from "./TaskDrawer";
import "./tasks.css";

export function TasksScreen({ route }: { route: Route }) {
  const { t, tx } = useI18n();
  const { db, indexes } = useWorkspace();
  const access = useAccess();
  const reduced = useReduced();
  const get = (key: string) => route.query.get(key) ?? "";
  const view = get("view") === "list" ? "list" : "board";
  const who = get("who");
  const priority = get("priority");
  const [draft, setDraft] = useState(get("q"));
  const [creating, setCreating] = useState(false);
  const update = (patch: Record<string, string | undefined>) => setQuery(route, patch);

  useEffect(() => setDraft(get("q")), [route.query.get("q")]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (draft === get("q")) return;
    const timer = setTimeout(() => update({ q: draft || undefined }), 140);
    return () => clearTimeout(timer);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const team = db.users.filter((u) => u.role !== "Customer");
  const tasks = useMemo(() => {
    const q = normalize(get("q").trim());
    return db.tasks
      .filter((task) => (!who || task.assigneeId === (who === "me" ? CURRENT_USER : who)) && (!priority || task.priority === priority) && (!q || normalize(tx(task.title)).includes(q) || (task.orderId ?? "").toLowerCase().includes(q)))
      .sort(compareTasks);
  }, [db.tasks, who, priority, get("q"), tx]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = db.tasks.filter((task) => task.status !== "Done");
  const overdue = open.filter((task) => dueState(task) === "overdue").length;
  const today = open.filter((task) => task.due === TODAY).length;
  const openTask = (id: string) => navigate(formatRoute("tasks", id, route.query));

  const columns: Column<Task>[] = [
    {
      key: "task",
      header: t("tasks.columns.task"),
      width: "minmax(260px, 2.4fr)",
      area: "title",
      render: (task) => (
        <span className="cell-stack">
          <strong className="task-title">{tx(task.title)}</strong>
          <small>{task.orderId ?? (task.productId ? indexes.products.get(task.productId)?.name : "")}</small>
        </span>
      ),
    },
    {
      key: "assignee",
      header: t("tasks.columns.assignee"),
      width: "minmax(150px, 1fr)",
      area: "who",
      hide: 720,
      render: (task) => {
        const user = indexes.users.get(task.assigneeId);
        return user ? (
          <span className="cell-person">
            <Avatar name={user.name} tone={user.avatar} size={24} />
            <span className="cell-muted">{user.name}</span>
          </span>
        ) : null;
      },
    },
    { key: "due", header: t("tasks.columns.due"), width: "minmax(120px, 0.8fr)", area: "due", render: (task) => <DueLabel task={task} /> },
    { key: "priority", header: t("tasks.columns.priority"), width: "minmax(100px, 0.7fr)", hide: 1100, render: (task) => <Badge tone={task.priority === "High" ? "danger" : task.priority === "Medium" ? "warning" : "neutral"}>{t(`tasks.priority.${task.priority}` as Key)}</Badge> },
    { key: "status", header: t("tasks.columns.status"), width: "minmax(110px, 0.8fr)", area: "status", render: (task) => <Badge tone={task.status === "Done" ? "positive" : task.status === "In progress" ? "accent" : "neutral"}>{t(`tasks.status.${task.status === "In progress" ? "progress" : task.status.toLowerCase()}` as Key)}</Badge> },
  ];

  return (
    <motion.div className="page" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : stagger.cards } } }}>
      <motion.header className="page-head" variants={fadeUp}>
        <div className="page-head__main">
          <h1 className="page-head__title">{t("tasks.title")}</h1>
          <p className="page-head__subtitle">{t("tasks.subtitle", { open: open.length, overdue, today })}</p>
        </div>
        <div className="page-head__side">
          <Segmented
            size="sm"
            label={t("tasks.viewLabel")}
            value={view}
            onChange={(v) => update({ view: v === "board" ? undefined : v })}
            options={[
              { value: "board", label: <Columns3 aria-label={t("tasks.views.board")} />, hint: t("tasks.views.board") },
              { value: "list", label: <ListChecks aria-label={t("tasks.views.list")} />, hint: t("tasks.views.list") },
            ]}
          />
          <Button variant="primary" icon={<Plus />} disabled={!access.can("tasks.manage")} onClick={() => setCreating(true)}>
            {t("tasks.new")}
          </Button>
        </div>
      </motion.header>
      <motion.div className="page__toolbar" variants={fadeUp}>
        <SearchField value={draft} onChange={setDraft} placeholder={t("tasks.search")} />
        <div className="page__filters">
          <Select label={t("tasks.filters.who")} value={who} onChange={(v) => update({ who: v || undefined })} options={[{ value: "", label: t("tasks.filters.everyone") }, { value: "me", label: t("tasks.filters.me") }, ...team.map((u) => ({ value: u.id, label: u.name }))]} />
          <Select label={t("tasks.filters.priority")} value={priority} onChange={(v) => update({ priority: v || undefined })} options={[{ value: "", label: t("tasks.filters.anyPriority") }, ...(["High", "Medium", "Low"] as const).map((p) => ({ value: p, label: t(`tasks.priority.${p}` as Key) }))]} />
        </div>
      </motion.div>
      <motion.div variants={fadeUp}>
        {!tasks.length ? (
          <EmptyState icon={<ListChecks />} title={t("tasks.empty.title")} text={t("tasks.empty.text")} action={<Button onClick={() => (setDraft(""), navigate(formatRoute("tasks"), { replace: true }))}>{t("orders.filters.reset")}</Button>} />
        ) : view === "board" ? (
          <TaskBoard tasks={tasks} onOpen={openTask} activeId={route.id} />
        ) : (
          <DataTable label={t("tasks.title")} rows={tasks} columns={columns} getId={(task) => task.id} total={tasks.length} activeId={route.id} onOpen={openTask} swapKey={route.query.toString()} mobile={{ areas: '"title title" "due status"', columns: "minmax(0, 1fr) auto" }} empty={null} />
        )}
      </motion.div>
      <TaskDrawer taskId={route.id} onClose={() => navigate(formatRoute("tasks", undefined, route.query))} />
      <NewTaskDialog open={creating} onClose={() => setCreating(false)} />
    </motion.div>
  );
}
