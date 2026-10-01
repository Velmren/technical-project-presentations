import { ClipboardPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { TODAY, addDays, now } from "../../data/clock";
import { CURRENT_USER, nextId, useWorkspace } from "../../data/store";
import { useI18n } from "../../i18n";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Overlay";
import { TaskForm, useTaskValidation, type TaskDraft, type TaskErrors } from "./TaskForm";

const empty = (): TaskDraft => ({ title: "", description: "", assigneeId: CURRENT_USER, due: addDays(TODAY, 1), priority: "Medium", status: "Backlog", orderId: "" });

export function NewTaskDialog({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: Partial<TaskDraft> }) {
  const { t } = useI18n();
  const { db, dispatch } = useWorkspace();
  const validate = useTaskValidation();
  const [draft, setDraft] = useState<TaskDraft>(empty);
  const [errors, setErrors] = useState<TaskErrors>({});
  useEffect(() => {
    if (!open) return;
    setDraft({ ...empty(), ...preset });
    setErrors({});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length) return;
    const result = dispatch({
      type: "task.create",
      task: {
        id: nextId(db, "TSK"),
        title: draft.title.trim(),
        description: draft.description.trim(),
        assigneeId: draft.assigneeId,
        due: draft.due,
        created: now(),
        status: "Backlog",
        priority: draft.priority,
        ...(draft.orderId.trim() ? { orderId: draft.orderId.trim().toUpperCase() } : {}),
      },
    });
    if (result.ok) onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      icon={<ClipboardPlus />}
      title={t("tasks.newTitle")}
      actions={
        <>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" onClick={submit}>
            {t("tasks.create")}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <TaskForm draft={draft} onChange={setDraft} errors={errors} />
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
