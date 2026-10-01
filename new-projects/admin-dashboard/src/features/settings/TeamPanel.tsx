import { LayoutGroup, motion } from "motion/react";
import { Check, Lock, Minus, UserPlus } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { useAccess } from "../../app/access";
import { TODAY } from "../../data/clock";
import { roleCapabilities, teamRoles, type Capability } from "../../data/permissions";
import { CURRENT_USER, nextId, useWorkspace } from "../../data/store";
import type { TeamRole, User } from "../../data/types";
import { useI18n, type Key } from "../../i18n";
import { useReduced } from "../../motion/MotionPreference";
import { duration, ease, spring, staggerDelay } from "../../motion/tokens";
import { Avatar } from "../../ui/Avatar";
import { Badge, type Tone } from "../../ui/Badge";
import { Panel } from "../../ui/Blocks";
import { Button, cx } from "../../ui/Button";
import { Field, Input, NativeSelect } from "../../ui/Form";
import { Dialog } from "../../ui/Overlay";

const statusTone: Record<User["status"], Tone> = { Active: "positive", Invited: "accent", Suspended: "warning" };
const assignable: TeamRole[] = ["Manager", "Support", "Fulfilment", "Finance"];
const capabilityKey = (capability: Capability) => capability.replace(/\.(\w)/, (_, letter: string) => letter.toUpperCase());
// A capability added to permissions.ts needs a place here, or the matrix will not show it.
const groups: [string, Capability[]][] = [
  ["orders", ["orders.fulfil", "orders.cancel"]],
  ["payments", ["payments.view", "payments.manage"]],
  ["customers", ["customers.view", "customers.manage"]],
  ["products", ["products.edit", "products.stock"]],
  ["work", ["tasks.manage", "messages.reply"]],
  ["reports", ["analytics.view"]],
  ["settings", ["settings.workspace", "settings.team"]],
];

export function TeamPanel() {
  const { t, tx, fullDate } = useI18n();
  const { db, dispatch } = useWorkspace();
  const access = useAccess();
  const reduced = useReduced();
  const [inviting, setInviting] = useState(false);
  const canManage = access.can("settings.team");
  const team = db.users.filter((user) => user.role !== "Customer");
  const withAccess = team.filter((user) => user.status !== "Suspended").length;

  return (
    <Panel
      animate={false}
      title={t("settings.team.title")}
      subtitle={t("settings.team.text", { count: withAccess })}
      actions={
        <Button variant="primary" size="sm" icon={<UserPlus />} disabled={!canManage} title={canManage ? undefined : access.deniedHint} onClick={() => setInviting(true)}>
          {t("settings.team.invite")}
        </Button>
      }
    >
      {!canManage && (
        <p className="settings-lock settings-lock--inset">
          <Lock />
          {t("settings.team.locked")}
        </p>
      )}
      <LayoutGroup id="team">
        <ul className="team-list">
          {team.map((user, index) => {
            const self = user.id === CURRENT_USER;
            return (
              <motion.li
                key={user.id}
                layout={!reduced}
                className={cx("team-row", user.status === "Suspended" && "is-paused")}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out, delay: staggerDelay(index, 0.02) } }}
                transition={spring.layout}
              >
                <Avatar name={user.name} tone={user.avatar} size={36} />
                <span className="team-row__who">
                  <span className="team-row__line">
                    <strong>{user.name}</strong>
                    {self && <span className="team-row__you">{t("settings.team.you")}</span>}
                    {user.status !== "Active" && (
                      <span className="team-row__status">
                        <Badge tone={statusTone[user.status]}>{t(`settings.team.status.${user.status}` as Key)}</Badge>
                        {user.status === "Invited" && <small>{fullDate(user.joined)}</small>}
                      </span>
                    )}
                  </span>
                  <small>{user.title ? tx(user.title) : user.email}</small>
                </span>
                <span className="team-row__email">{user.email}</span>
                <span className="team-row__role">
                  {self ? (
                    <span className="team-row__fixed">{t("team.roles.Owner")}</span>
                  ) : (
                    <NativeSelect
                      aria-label={t("settings.team.roleLabel", { user: user.name })}
                      value={user.role}
                      disabled={!canManage || user.status === "Suspended"}
                      onChange={(event) => dispatch({ type: "user.update", id: user.id, patch: { role: event.target.value as TeamRole } })}
                      options={assignable.map((role) => ({ value: role, label: t(`team.roles.${role}` as Key) }))}
                    />
                  )}
                </span>
                <span className="team-row__action">
                  {!self && user.status === "Active" && (
                    <Button size="sm" variant="ghost" className="is-quiet" disabled={!canManage} onClick={() => dispatch({ type: "user.update", id: user.id, patch: { status: "Suspended" } })}>
                      {t("settings.team.pause")}
                    </Button>
                  )}
                  {user.status === "Suspended" && (
                    <Button size="sm" variant="ghost" disabled={!canManage} onClick={() => dispatch({ type: "user.update", id: user.id, patch: { status: "Active" } })}>
                      {t("settings.team.restore")}
                    </Button>
                  )}
                  {user.status === "Invited" && (
                    <Button size="sm" variant="ghost" disabled={!canManage} onClick={() => dispatch({ type: "user.revoke", id: user.id })}>
                      {t("settings.team.revoke")}
                    </Button>
                  )}
                </span>
              </motion.li>
            );
          })}
        </ul>
      </LayoutGroup>
      <InviteDialog open={inviting} onClose={() => setInviting(false)} />
    </Panel>
  );
}

function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { db, dispatch } = useWorkspace();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("Support");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  useEffect(() => {
    if (!open) return;
    setName("");
    setEmail("");
    setRole("Support");
    setErrors({});
  }, [open]);

  const submit = () => {
    const found: typeof errors = {};
    const cleanEmail = email.trim();
    if (name.trim().length < 2) found.name = t("settings.team.errors.name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) found.email = t("settings.team.errors.email");
    else if (db.users.some((user) => user.email.toLowerCase() === cleanEmail.toLowerCase())) found.email = t("settings.team.errors.taken", { email: cleanEmail });
    setErrors(found);
    if (Object.keys(found).length) return;
    const team = db.users.filter((user) => user.role !== "Customer").length;
    const result = dispatch({
      type: "user.invite",
      user: { id: nextId(db, "USR"), name: name.trim(), email: cleanEmail, role, status: "Invited", joined: TODAY, region: "", country: "", avatar: team % 8 },
    });
    if (result.ok) onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      icon={<UserPlus />}
      title={t("settings.team.inviteTitle")}
      actions={
        <>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" onClick={submit}>
            {t("settings.team.inviteSend")}
          </Button>
        </>
      }
    >
      <form
        className="invite-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <p className="invite-form__text">{t("settings.team.inviteText")}</p>
        <Field label={t("settings.team.fields.name")} error={errors.name}>
          {(field) => <Input {...field} value={name} autoComplete="off" data-autofocus onChange={(event) => setName(event.target.value)} />}
        </Field>
        <Field label={t("settings.team.fields.email")} error={errors.email}>
          {(field) => <Input {...field} type="email" value={email} autoComplete="off" placeholder="name@northline.example" onChange={(event) => setEmail(event.target.value)} />}
        </Field>
        <Field label={t("settings.team.fields.role")} hint={t(`settings.team.roleHint.${role}` as Key)}>
          {(field) => <NativeSelect {...field} value={role} onChange={(event) => setRole(event.target.value as TeamRole)} options={assignable.map((value) => ({ value, label: t(`team.roles.${value}` as Key) }))} />}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

export function RolesMatrix() {
  const { t } = useI18n();
  const { db } = useWorkspace();
  const access = useAccess();
  const people = (role: TeamRole) => db.users.filter((user) => user.role === role && user.status !== "Suspended").length;
  return (
    <Panel animate={false} title={t("settings.roles.title")} subtitle={t("settings.roles.text")}>
      <div className="matrix-scroll">
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col" className="matrix__corner" />
              {teamRoles.map((role) => {
                const current = access.role === role;
                return (
                  <th key={role} scope="col" className={cx(current && "is-current")}>
                    {current && <motion.span className="matrix__highlight" layoutId="matrix-role" transition={spring.indicator} aria-hidden="true" />}
                    <span className="matrix__role">{t(`team.roles.${role}` as Key)}</span>
                    <span className="matrix__people">{t("settings.roles.people", { count: people(role) })}</span>
                    {current ? (
                      <span className="matrix__now">{t("settings.roles.current")}</span>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => access.setRole(role)}>
                        {t("settings.roles.viewAs")}
                      </Button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {groups.map(([group, list]) => (
              <Fragment key={group}>
                <tr className="matrix__group">
                  <th scope="rowgroup" colSpan={teamRoles.length + 1}>
                    {t(`settings.roles.groups.${group}` as Key)}
                  </th>
                </tr>
                {list.map((capability) => (
                  <tr key={capability}>
                    <th scope="row">{t(`settings.roles.caps.${capabilityKey(capability)}` as Key)}</th>
                    {teamRoles.map((role) => {
                      const allowed = roleCapabilities[role].includes(capability);
                      return (
                        <td key={role} className={cx(allowed ? "is-yes" : "is-no", access.role === role && "is-current")}>
                          {allowed ? <Check aria-label={t("settings.roles.yes")} /> : <Minus aria-label={t("settings.roles.no")} />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
