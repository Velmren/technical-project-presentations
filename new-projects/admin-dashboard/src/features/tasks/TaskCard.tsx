import { motion } from "motion/react";
import { CalendarClock, Package, ShoppingBag } from "lucide-react";
import { forwardRef, type HTMLAttributes } from "react";
import { TODAY, addDays } from "../../data/clock";
import { useWorkspace } from "../../data/store";
import type { Task } from "../../data/types";
import { useI18n, type Key } from "../../i18n";
import { Avatar } from "../../ui/Avatar";
import { KeepIds } from "../../ui/Blocks";
import { cx } from "../../ui/Button";

export type DueState = "overdue" | "today" | "soon" | "later" | "done";

export function dueState(task: Task): DueState {
  if (task.status === "Done") return "done";
  if (task.due < TODAY) return "overdue";
  if (task.due === TODAY) return "today";
  if (task.due <= addDays(TODAY, 2)) return "soon";
  return "later";
}

const priorityRank = { High: 0, Medium: 1, Low: 2 } as const;

/** Open work: overdue first, then by due date and priority. Done work: most recent first. */
export function compareTasks(a: Task, b: Task) {
  if (a.status === "Done" && b.status === "Done") return a.due < b.due ? 1 : a.due > b.due ? -1 : 0;
  if (a.due !== b.due) return a.due < b.due ? -1 : 1;
  return priorityRank[a.priority] - priorityRank[b.priority];
}

export function DueLabel({ task }: { task: Task }) {
  const { t, date } = useI18n();
  const state = dueState(task);
  const text = state === "overdue" ? t("tasks.due.overdue", { date: date(task.due) }) : state === "today" ? t("tasks.due.today") : task.due === addDays(TODAY, 1) ? t("tasks.due.tomorrow") : date(task.due);
  return (
    <span className={cx("due", `due--${state}`)}>
      <CalendarClock />
      {text}
    </span>
  );
}

type Props = HTMLAttributes<HTMLDivElement> & { task: Task; dragging?: boolean; overlay?: boolean; layoutId?: string; onOpen?: () => void };

export const TaskCard = forwardRef<HTMLDivElement, Props>(function TaskCard({ task, dragging, overlay, layoutId, onOpen, className, style, ...rest }, ref) {
  const { t, tx } = useI18n();
  const { indexes } = useWorkspace();
  const assignee = indexes.users.get(task.assigneeId);
  const product = task.productId ? indexes.products.get(task.productId) : undefined;
  return (
    <motion.div
      ref={ref}
      layoutId={layoutId}
      className={cx("tcard", `tcard--${task.priority.toLowerCase()}`, task.status === "Done" && "is-done", dragging && "is-placeholder", overlay && "is-overlay", className)}
      style={style}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      animate={overlay ? { scale: 1.04, rotate: 1.5, boxShadow: "0 24px 48px rgba(0,0,0,0.5)" } : { scale: 1, rotate: 0 }}
      onClick={onOpen}
      {...(rest as object)}
    >
      <span className="tcard__priority" title={t(`tasks.priority.${task.priority}` as Key)} aria-label={t(`tasks.priority.${task.priority}` as Key)} />
      <p className="tcard__title"><KeepIds text={tx(task.title)} /></p>
      {(task.orderId || product) && (
        <span className="tcard__links">
          {task.orderId && (
            <span className="tcard__chip num">
              <ShoppingBag />
              {task.orderId}
            </span>
          )}
          {product && (
            <span className="tcard__chip">
              <Package />
              {product.name}
            </span>
          )}
        </span>
      )}
      <span className="tcard__foot">
        <DueLabel task={task} />
        {assignee && (
          <span className="tcard__who" title={assignee.name}>
            <Avatar name={assignee.name} tone={assignee.avatar} size={22} />
          </span>
        )}
      </span>
    </motion.div>
  );
});
