import type { CSSProperties, ReactNode } from "react";

export type StatusBadgeVariant = "pending" | "success" | "danger" | "ambiguous";

export type StatusBadgeProps = {
  variant: StatusBadgeVariant;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: "span" | "p";
};

export function StatusBadge({
  variant,
  children,
  className = "",
  style,
  as: Tag = "span",
}: StatusBadgeProps) {
  return (
    <Tag className={`status-badge status-badge--${variant} ${className}`.trim()} style={style}>
      {children}
    </Tag>
  );
}