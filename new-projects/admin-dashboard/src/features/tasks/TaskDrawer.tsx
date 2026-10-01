import { motion } from "motion/react";
import { ArrowUpRight, CheckCircle2, FileSearch, Package, Save, ShoppingBag, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAccess } from "../../app/access";
import { formatRoute, navigate } from "../../app/router";
import { useWorkspace } from "../../data/store";
import type { Task } from "../../data/types";
import { useI18n } from "../../i18n";
import { useReduced } from "../../motion/MotionPreference";
import { duration, ease } from "../../motion/tokens";
import { Avatar } from "../../ui/Avatar";
import { EmptyState, KeepIds } from "../../ui/Blocks";
import { Button } from "../../ui/Button";
import { Drawer } from "../../ui/Overlay";
import { DueLabel } from "./TaskCard";
import { TaskForm, useTaskValidation, type TaskDraft, type TaskErrors } from "./TaskForm";

export function TaskDrawer({ taskId, onClose }: { taskId?: string; onClose: () => void }) {
  const { t, tx } = useI18n();
  const { db } = useWorkspace();
  const task = taskId ? db.tasks.find((item) => item.id === taskId) : undefined;
  return (
    <Drawer
      open={!!taskId}
      onClose={onClose}
      width={560}
      label={task ? tx(task.title) : t("shell.notFound", { id: taskId ?? "" })}
      header={
        task ? (
          <div className="od-head">
            <p className="od-head__eyebrow num">{task.id}</p>
            <h2 className="od-head__title task-drawer__title"><KeepIds text={tx(task.title)} /></h2>
          </div>
        ) : (
          <h2 className="od-head__title">{taskId}</h2>
        )
      }
    >
      {task ? <TaskDetail task={task} /> : <EmptyState icon={<FileSearch />} title={t("shell.notFound", { id: taskId ?? "" })} text={t("shell.notFoundHint")} />}
    </Drawer>
  );
}

function TaskDetail({ task }: { task: Task }) {
  const { t, tx, stamp } = useI18n();
  const { indexes, dispatch } = useWorkspace();
  const access = useAccess();
  const reduced = useReduced();
  const validate = useTaskValidation();
  const initial = useMemo<TaskDraft>(() => ({ title: tx(task.title), description: tx(task.description), assigneeId: task.assigneeId, due: task.due, priority: task.priority, status: task.status, orderId: task.orderId ?? "" }), [task, tx]);
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<TaskErrors>({});
  useEffect(() => {
    setDraft(initial);
    setErrors({});
  }, [initial]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const canEdit = access.can("tasks.manage");
  const assignee = indexes.users.get(task.assigneeId);
  const product = task.productId ? indexes.products.get(task.productId) : undefined;

  const save = () => {
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length) return;
    // Generated tasks keep their translatable text until someone actually edits it.
    dispatch({
      type: "task.update",
      id: task.id,
      patch: {
        ...(draft.title !== initial.title ? { title: draft.title.trim() } : {}),
        ...(draft.description !== initial.description ? { description: draft.description.trim() } : {}),
        assigneeId: draft.assigneeId,
        due: draft.due,
        priority: draft.priority,
        status: draft.status,
        orderId: draft.orderId.trim() ? draft.orderId.trim().toUpperCase() : undefined,
      },
    });
  };

  const container = { hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : 0.05, delayChildren: reduced ? 0 : 0.06 } } };
  const block = { hidden: reduced ? { opacity: 0 } : { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: duration.slow, ease: ease.out } } };

  return (
    <motion.div className="od" variants={container} initial="hidden" animate="show">
      <motion.section className="task-meta" variants={block}>
        <DueLabel task={task} />
        {assignee && (
          <span className="task-meta__who">
            <Avatar name={assignee.name} tone={assignee.avatar} size={22} />
            {assignee.name}
          </span>
        )}
        <span className="task-meta__created">{t("tasks.detail.created", { date: stamp(task.created) })}</span>
      </motion.section>

      {task.status !== "Done" && (
        <motion.section className="od-next" variants={block}>
          <div className="od-next__text">
            <p className="od-label">{t("orders.detail.nextStep")}</p>
            <p>{task.status === "Backlog" ? t("tasks.detail.startHint") : t("tasks.detail.finishHint")}</p>
          </div>
          <Button variant="primary" icon={<CheckCircle2 />} disabled={!canEdit} onClick={() => dispatch({ type: "task.update", id: task.id, patch: { status: task.status === "Backlog" ? "In progress" : "Done" } })}>
            {task.status === "Backlog" ? t("tasks.detail.start") : t("tasks.detail.finish")}
          </Button>
        </motion.section>
      )}

      {(task.orderId || product) && (
        <motion.section className="od-block" variants={block}>
          <h3 className="od-label">{t("orders.detail.related")}</h3>
          <ul className="od-related">
            {task.orderId && (
              <li>
                <a
                  href={formatRoute("orders", task.orderId)}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(formatRoute("orders", task.orderId));
                  }}
                >
                  <ShoppingBag />
                  <span className="num">{task.orderId}</span>
                  <ArrowUpRight />
                </a>
              </li>
            )}
            {product && (
              <li>
                <a
                  href={formatRoute("products", product.id)}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(formatRoute("products", product.id));
                  }}
                >
                  <Package />
                  <span>{product.name}</span>
                  <ArrowUpRight />
                </a>
              </li>
            )}
          </ul>
        </motion.section>
      )}

      <motion.section className="od-block" variants={block}>
        <h3 className="od-label">{t("tasks.detail.edit")}</h3>
        <TaskForm draft={draft} onChange={setDraft} errors={errors} withStatus disabled={!canEdit} />
        <div className="pd-save">
          <Button variant="ghost" icon={<Undo2 />} disabled={!dirty} onClick={() => (setDraft(initial), setErrors({}))}>
            {t("products.detail.revert")}
          </Button>
          <Button variant="primary" icon={<Save />} disabled={!dirty || !canEdit} onClick={save}>
            {t("common.save")}
          </Button>
        </div>
      </motion.section>
    </motion.div>
  );
}
