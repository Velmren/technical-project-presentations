import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent, type KeyboardCoordinateGetter } from "@dnd-kit/core";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useAccess } from "../../app/access";
import { TODAY, addDays } from "../../data/clock";
import { useWorkspace } from "../../data/store";
import type { Task, TaskStatus } from "../../data/types";
import { useI18n, type Key } from "../../i18n";
import { useReduced } from "../../motion/MotionPreference";
import { spring, staggerDelay } from "../../motion/tokens";
import { cx } from "../../ui/Button";
import { TaskCard } from "./TaskCard";

export const columns: TaskStatus[] = ["Backlog", "In progress", "Done"];

// Arrow keys jump a picked-up card to the neighbouring column instead of nudging it by a few pixels.
const byColumn: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  const step = event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0;
  if (!step) return event.code === "ArrowUp" || event.code === "ArrowDown" ? currentCoordinates : undefined;
  const rects = [...context.droppableRects.entries()].sort((a, b) => a[1].left - b[1].left);
  const card = context.collisionRect;
  if (!rects.length || !card) return undefined;
  const centre = card.left + card.width / 2;
  const current = Math.max(0, rects.findIndex(([, rect]) => centre >= rect.left && centre <= rect.right));
  const target = rects[Math.min(rects.length - 1, Math.max(0, current + step))][1];
  return { x: target.left + (target.width - card.width) / 2, y: currentCoordinates.y };
};

/**
 * Kanban board. Cards are dragged with the pointer or the keyboard (space, arrows, space).
 * While dragging, the card lifts on a spring; on drop it glides into its new column.
 */
export function TaskBoard({ tasks, onOpen, activeId }: { tasks: Task[]; onOpen: (id: string) => void; activeId?: string }) {
  const { t } = useI18n();
  const { dispatch } = useWorkspace();
  const access = useAccess();
  const [dragging, setDragging] = useState<string | null>(null);
  const [showAllDone, setShowAllDone] = useState(false);
  // A mouse drags after a few pixels; a finger has to press and hold, so a swipe over the cards still scrolls the page.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: byColumn }),
  );
  const recent = addDays(TODAY, -14);

  const onDragStart = (event: DragStartEvent) => setDragging(String(event.active.id));
  const onDragEnd = (event: DragEndEvent) => {
    const id = String(event.active.id);
    const to = event.over?.id as TaskStatus | undefined;
    const task = tasks.find((item) => item.id === id);
    setDragging(null);
    if (task && to && to !== task.status) dispatch({ type: "task.update", id, patch: { status: to } });
  };
  const active = dragging ? tasks.find((task) => task.id === dragging) : undefined;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)} accessibility={{ screenReaderInstructions: { draggable: t("tasks.board.dragHint") } }}>
      <LayoutGroup id="board">
        <div className="board">
          {columns.map((status) => {
            const all = tasks.filter((task) => task.status === status);
            const visible = status === "Done" && !showAllDone ? all.filter((task) => task.due >= recent) : all;
            return (
              <Column key={status} status={status} count={all.length}>
                <AnimatePresence initial={false}>
                  {visible.map((task, index) => (
                    <DraggableCard key={task.id} task={task} index={index} hidden={task.id === dragging} disabled={!access.can("tasks.manage")} active={task.id === activeId} onOpen={() => onOpen(task.id)} />
                  ))}
                </AnimatePresence>
                {status === "Done" && all.length > visible.length && (
                  <button type="button" className="board__more" onClick={() => setShowAllDone(true)}>
                    {t("tasks.board.showDone", { count: all.length - visible.length })}
                  </button>
                )}
                {!visible.length && <p className="board__empty">{t(`tasks.board.empty.${status === "In progress" ? "progress" : status.toLowerCase()}` as Key)}</p>}
              </Column>
            );
          })}
        </div>
        {createPortal(
          <DragOverlay dropAnimation={null} zIndex={70}>
            {active ? <TaskCard task={active} overlay layoutId={active.id} /> : null}
          </DragOverlay>,
          document.body,
        )}
      </LayoutGroup>
    </DndContext>
  );
}

function Column({ status, count, children }: { status: TaskStatus; count: number; children: React.ReactNode }) {
  const { t } = useI18n();
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const key = status === "In progress" ? "progress" : status.toLowerCase();
  return (
    <section ref={setNodeRef} className={cx("board__col", `board__col--${key}`, isOver && "is-over")} aria-label={t(`tasks.status.${key}` as Key)}>
      <header className="board__head">
        <span className="board__dot" aria-hidden="true" />
        <h2>{t(`tasks.status.${key}` as Key)}</h2>
        <span className="board__count num">{count}</span>
      </header>
      <div className="board__list">{children}</div>
    </section>
  );
}

function DraggableCard({ task, index, hidden, disabled, active, onOpen }: { task: Task; index: number; hidden: boolean; disabled: boolean; active: boolean; onOpen: () => void }) {
  const reduced = useReduced();
  const { attributes, listeners, setNodeRef } = useDraggable({ id: task.id, disabled });
  return (
    <motion.div
      ref={setNodeRef}
      className="board__slot"
      layout={!reduced}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, transition: { ...spring.layout, delay: staggerDelay(index, 0.03) } }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={spring.layout}
    >
      {/* While the card travels with the pointer, its old place shows where it came from. */}
      {hidden ? <div className="tcard-placeholder" aria-hidden="true" /> : <TaskCard task={task} layoutId={task.id} className={cx(active && "is-active")} onOpen={onOpen} {...attributes} {...listeners} />}
    </motion.div>
  );
}
