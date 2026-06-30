import { StatusBadge } from "./StatusBadge.tsx";

export type CommandNoticeProps = {
  message: string;
};

export function CommandNotice({ message }: CommandNoticeProps) {
  return (
    <StatusBadge variant="danger" as="p" style={{ marginTop: "var(--space-sm)" }}>
      {message}
    </StatusBadge>
  );
}