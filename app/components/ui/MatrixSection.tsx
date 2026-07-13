"use client";

import { useState, type ReactNode } from "react";
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
    <section
      className={cn(
        "rounded-xl border border-slate-800/90 bg-slate-900/80 shadow-sm shadow-black/10",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 px-5 py-3.5 md:px-6">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="flex flex-1 items-start gap-3 rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          aria-expanded={isOpen}
        >
          <span
            className={cn(
              "mt-1 text-slate-500 transition-transform",
              isOpen ? "rotate-90" : "",
            )}
            aria-hidden
          >
            ▸
          </span>
          <span>
            <span className="block text-base font-semibold text-white md:text-lg">
              {title}
            </span>
            {subtitle && (
              <span className="mt-1 block text-sm font-normal text-slate-400">
                {subtitle}
              </span>
            )}
          </span>
        </button>
        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </div>
      {isOpen && <div className="p-5 md:p-6">{children}</div>}
    </section>
  );
}
