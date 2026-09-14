import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./utils";

export type MatrixButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger";

export type MatrixButtonSize = "sm" | "md" | "lg";

export type MatrixButtonProps = {
  variant?: MatrixButtonVariant;
  size?: MatrixButtonSize;
  href?: string;
  children: ReactNode;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">;

const variantStyles: Record<MatrixButtonVariant, string> = {
  primary:
    "border-transparent bg-cyan-500 text-slate-950 hover:bg-cyan-400 focus-visible:ring-cyan-500",
  secondary:
    "border-slate-600 bg-transparent text-slate-200 hover:border-cyan-500 hover:bg-slate-800 hover:text-cyan-300 focus-visible:ring-slate-500",
  success:
    "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 focus-visible:ring-emerald-500",
  warning:
    "border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 focus-visible:ring-amber-500",
  danger:
    "border-rose-500/50 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 focus-visible:ring-rose-500",
};

const sizeStyles: Record<MatrixButtonSize, string> = {
  sm: "min-h-9 px-3 py-2 text-sm",
  md: "min-h-11 px-4 py-2.5 text-sm",
  lg: "min-h-12 px-6 py-3 text-base",
};

const baseStyles =
  "matrix-button inline-flex items-center justify-center rounded-lg border font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50";

export default function MatrixButton({
  variant = "primary",
  size = "md",
  href,
  children,
  className,
  type = "button",
  ...props
}: MatrixButtonProps) {
  const classes = cn(
    baseStyles,
    variantStyles[variant],
    sizeStyles[size],
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
}
