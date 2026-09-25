import { FOLLOW_UP_STATUS_ICONS, type FollowUpStatus } from "@/lib/personal-research";

/**
 * 跟进状态图标。
 *
 * 状态图标是按字符串键查表得到的组件，没法直接写进 JSX
 * （`<FOLLOW_UP_STATUS_ICONS[x] />` 语法不成立），所以统一收在这里。
 */
export function StatusIcon({
  status,
  className,
}: {
  status: FollowUpStatus;
  className?: string;
}) {
  const Icon = FOLLOW_UP_STATUS_ICONS[status];
  return <Icon className={className} aria-hidden />;
}
