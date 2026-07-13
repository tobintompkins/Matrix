"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "./utils";

export type MatrixSearchBarProps = {
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  id?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type" | "value" | "onChange">;

export default function MatrixSearchBar({
  placeholder = "Search…",
  value,
  onValueChange,
  className,
  id = "matrix-search",
  ...props
}: MatrixSearchBarProps) {
  return (
    <div className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        Search
      </label>
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </span>
      <input
        id={id}
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onValueChange?.(event.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 py-3 pl-12 pr-4 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        {...props}
      />
    </div>
  );
}
