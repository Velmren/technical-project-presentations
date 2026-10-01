import { motion, type HTMLMotionProps } from "motion/react";
import { forwardRef, type ReactNode } from "react";
import { duration } from "../motion/tokens";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

type ButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "quiet";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  iconEnd?: ReactNode;
  iconOnly?: boolean;
  children?: ReactNode;
};

/** Buttons press down slightly on tap; the pressed state is interruptible and never blocks the click. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, iconEnd, iconOnly, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      className={cx("ui-btn", `ui-btn--${variant}`, `ui-btn--${size}`, iconOnly && "ui-btn--icon", className)}
      whileTap={rest.disabled ? undefined : { scale: 0.97, transition: { duration: duration.instant } }}
      {...rest}
    >
      {icon}
      {children !== undefined && children !== null && <span className="ui-btn__label">{children}</span>}
      {iconEnd}
    </motion.button>
  );
});
