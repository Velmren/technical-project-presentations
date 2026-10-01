import { useWorkspace } from "../../data/store";
import type { Priority, TaskStatus } from "../../data/types";
import { useI18n, type Key } from "../../i18n";
import { Field, Input, NativeSelect, TextArea } from "../../ui/Form";
import { Segmented } from "../../ui/Segmented";

export type TaskDraft = { title: string; description: string; assigneeId: string; due: string; priority: Priority; status: TaskStatus; orderId: string };
export type TaskErrors = Partial<Record<keyof TaskDraft, string>>;

export function useTaskValidation() {
  const { t } = useI18n();
  const { indexes } = useWorkspace();
  return (draft: TaskDraft): TaskErrors => {
    const errors: TaskErrors = {};
    const title = draft.title.trim();
    if (title.length < 3 || title.length > 120) errors.title = t("tasks.errors.title");
    if (draft.description.length > 1000) errors.description = t("tasks.errors.description");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.due) || Number.isNaN(Date.parse(draft.due))) errors.due = t("tasks.errors.due");
    const assignee = indexes.users.get(draft.assigneeId);
    if (!assignee || assignee.role === "Customer" || assignee.status !== "Active") errors.assigneeId = t("tasks.errors.assignee");
    const order = draft.orderId.trim().toUpperCase();
    if (order && !indexes.orders.has(order)) errors.orderId = t("tasks.errors.order", { order });
    return errors;
  };
}

export function TaskForm({ draft, onChange, errors, withStatus, disabled }: { draft: TaskDraft; onChange: (draft: TaskDraft) => void; errors: TaskErrors; withStatus?: boolean; disabled?: boolean }) {
  const { t } = useI18n();
  const { db } = useWorkspace();
  const team = db.users.filter((u) => u.role !== "Customer" && u.status === "Active");
  const set = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => onChange({ ...draft, [key]: value });
  return (
    <div className="task-form">
      <Field label={t("tasks.fields.title")} error={errors.title}>
        {(props) => <Input {...props} value={draft.title} disabled={disabled} onChange={(e) => set("title", e.target.value)} data-autofocus maxLength={140} />}
      </Field>
      <Field label={t("tasks.fields.description")} error={errors.description}>
        {(props) => <TextArea {...props} value={draft.description} disabled={disabled} rows={3} onChange={(e) => set("description", e.target.value)} />}
      </Field>
      <div className="form-grid">
        <Field label={t("tasks.fields.assignee")} error={errors.assigneeId}>
          {(props) => <NativeSelect {...props} value={draft.assigneeId} disabled={disabled} onChange={(e) => set("assigneeId", e.target.value)} options={team.map((u) => ({ value: u.id, label: `${u.name} · ${t(`team.roles.${u.role}` as Key)}` }))} />}
        </Field>
        <Field label={t("tasks.fields.due")} error={errors.due}>
          {(props) => <Input {...props} type="date" value={draft.due} disabled={disabled} onChange={(e) => set("due", e.target.value)} />}
        </Field>
        <Field label={t("tasks.fields.order")} error={errors.orderId} hint={t("tasks.fields.orderHint")}>
          {(props) => <Input {...props} value={draft.orderId} disabled={disabled} placeholder="NL-23786" onChange={(e) => set("orderId", e.target.value)} />}
        </Field>
        {withStatus && (
          <Field label={t("tasks.fields.status")}>
            {(props) => <NativeSelect {...props} value={draft.status} disabled={disabled} onChange={(e) => set("status", e.target.value as TaskStatus)} options={(["Backlog", "In progress", "Done"] as const).map((s) => ({ value: s, label: t(`tasks.status.${s === "In progress" ? "progress" : s.toLowerCase()}` as Key) }))} />}
          </Field>
        )}
      </div>
      <div className="field">
        <span className="field-label">{t("tasks.fields.priority")}</span>
        <Segmented size="sm" label={t("tasks.fields.priority")} value={draft.priority} onChange={(p) => !disabled && set("priority", p)} options={(["High", "Medium", "Low"] as const).map((p) => ({ value: p, label: t(`tasks.priority.${p}` as Key) }))} />
      </div>
    </div>
  );
}
