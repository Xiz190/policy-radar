export const MONITOR_START_DATE = "2026-05-05";
export const MONITOR_MAX_ITEMS = 10;
export const MONITOR_EMPTY_TEXT = "5月5日后无更新";

export function filterLatestItemsFromMonitorWindow<T>(
  items: T[],
  getDate: (item: T) => string | undefined,
  maxItems = MONITOR_MAX_ITEMS,
) {
  return items
    .filter((item) => {
      const date = getDate(item);
      return typeof date === "string" && date >= MONITOR_START_DATE;
    })
    .slice(0, maxItems);
}
