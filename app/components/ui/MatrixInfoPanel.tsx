import type { ReactNode } from "react";
import AppCard from "./AppCard";
import { cn } from "./utils";

export type MatrixInfoPanelProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export default function MatrixInfoPanel({
  title,
  subtitle,
  children,
  footer,
  className,
}: MatrixInfoPanelProps) {
  return (
    <AppCard
      as="aside"
      title={title}
      description={subtitle}
      footer={footer}
      className={cn(className)}
    >
      {children}
    </AppCard>
  );
}
