"use client";

import { useState, type ReactNode } from "react";
import AppCard from "./AppCard";
import { cn } from "./utils";

export type MatrixSectionProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  actions?: ReactNode;
  className?: string;
};

export default function MatrixSection({
  title,
  subtitle,
  children,
  defaultOpen = true,
  actions,
  className,
}: MatrixSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <AppCard
      className={className}
      padding={false}
      header={
        <div className="flex items-start justify-between gap-4">
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            className="flex flex-1 items-start gap-3 rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
            aria-expanded={isOpen}
          >
            <span
              className={cn(
                "mt-1 text-[color:var(--matrix-muted)] transition-transform",
                isOpen ? "rotate-90" : "",
              )}
              aria-hidden
            >
              ▸
            </span>
            <span>
              <span className="matrix-section-title block">{title}</span>
              {subtitle && (
                <span className="matrix-muted mt-1 block font-normal">
                  {subtitle}
                </span>
              )}
            </span>
          </button>
          {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
        </div>
      }
      body={
        isOpen ? (
          <div className="p-4 sm:p-5 md:p-6">{children}</div>
        ) : null
      }
    />
  );
}
