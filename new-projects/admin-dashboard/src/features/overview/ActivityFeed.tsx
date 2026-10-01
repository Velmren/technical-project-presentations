import { AnimatePresence, motion } from "motion/react";
import { eventIcon, eventLink, eventText } from "../../app/events";
import { navigate } from "../../app/router";
import { useWorkspace } from "../../data/store";
import { useI18n } from "../../i18n";
import { useReduced } from "../../motion/MotionPreference";
import { duration, foldAway, spring, staggerDelay } from "../../motion/tokens";
import { Avatar } from "../../ui/Avatar";
import { Panel } from "../../ui/Blocks";

export function ActivityFeed() {
  const { t, tx, relative } = useI18n();
  const { db, indexes } = useWorkspace();
  const reduced = useReduced();
  const events = db.events.slice(0, 7);

  return (
    <Panel className="activity" id="overview-activity" title={t("overview.activity.title")}>
      <ol className="activity__list">
        <AnimatePresence initial={false}>
          {events.map((event, index) => {
            const { icon: Icon, tone } = eventIcon(event);
            const actor = event.actorId ? indexes.users.get(event.actorId) : undefined;
            return (
              <motion.li
                key={event.id}
                layout={!reduced}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0, transition: { ...spring.layout, delay: 0.3 + staggerDelay(index) } }}
                exit={reduced ? { opacity: 0, transition: { duration: duration.fast } } : foldAway}
                transition={spring.layout}
              >
                <a
                  href={eventLink(event, indexes)}
                  className="activity__item"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(eventLink(event, indexes));
                  }}
                >
                  <span className={`event-icon event-icon--${tone}`} aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="activity__text">
                    <span className="activity__title">{eventText(event, db, t, tx)}</span>
                    <span className="activity__meta">
                      {actor && (
                        <>
                          <Avatar name={actor.name} tone={actor.avatar} size={16} />
                          <span>{actor.name}</span>
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      <time dateTime={event.at}>{relative(event.at)}</time>
                    </span>
                  </span>
                </a>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
      {!events.length && <p className="activity__empty">{t("overview.activity.empty")}</p>}
    </Panel>
  );
}
