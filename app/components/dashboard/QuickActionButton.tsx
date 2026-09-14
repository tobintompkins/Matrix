import type { ReactNode } from "react";
import MatrixButton, {
  type MatrixButtonVariant,
} from "@/app/components/ui/MatrixButton";
import { cn } from "@/app/components/ui/utils";

export type QuickActionButtonProps = {
  label: string;
  description?: string;
  href: string;
  icon?: ReactNode;
  variant?: MatrixButtonVariant;
  className?: string;
};

/** Compact permission-ready quick action control for Service Hub. */
export default function QuickActionButton({
  label,
  description,
  href,
  icon,
  variant = "secondary",
  className,
}: QuickActionButtonProps) {
  return (
    <MatrixButton
      href={href}
      variant={variant}
      size="md"
      className={cn(
        description ? "matrix-task-card min-h-24 w-full justify-start gap-4 text-left" : "min-h-11 w-full justify-start gap-2 text-left",
        variant === "secondary" &&
          "border-slate-700/80 bg-slate-950/40",
        className,
      )}
      aria-label={label}
    >
      {icon ? (
        <span className={description ? "matrix-task-icon" : "shrink-0 text-current"} aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block whitespace-normal">{label}</span>
        {description && <span className="mt-1 block text-xs font-normal leading-relaxed opacity-80">{description}</span>}
      </span>
      {description && <span aria-hidden className="text-lg opacity-60">→</span>}
    </MatrixButton>
  );
}
