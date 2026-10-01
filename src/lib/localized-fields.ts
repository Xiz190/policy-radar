/**
 * 双语字段的选取。
 *
 * 有几类字段我们存了中英两份：创作者视角（lens）、来源显示名。
 * 它们都是**我们自己产出的标签或判断**，不是抓来的内容——所以不适用
 * "界面本地化、内容保留原文"那条，两边都该有对应语言。
 *
 * 桌面站按界面语言二选一；伴侣版固定英文。
 */

export type LensLanguage = "zh" | "en";

/**
 * 通用选择：优先取当前语言那份，**缺失时回退另一种**。
 *
 * 为什么回退而不是返回 null：某条还没生成另一种语言时，宁可显示另一种，
 * 也不要让整块内容凭空消失——那看起来像坏了。
 * 两份都没有才返回 null。
 */
function pickLocalized(zh: string | null | undefined, en: string | null | undefined, language: LensLanguage): string | null {
  const zhTrim = (zh ?? "").trim();
  const enTrim = (en ?? "").trim();
  if (language === "en") return enTrim || zhTrim || null;
  return zhTrim || enTrim || null;
}

type HasLens = { creatorLens?: string | null; creatorLensEn?: string | null };
type HasSourceName = { displayName?: string | null; displayNameEn?: string | null };

/** 取当前语言下该显示的那句「创作者视角」。 */
export function pickLens(item: HasLens | null | undefined, language: LensLanguage): string | null {
  return pickLocalized(item?.creatorLens, item?.creatorLensEn, language);
}

/** 取当前语言下该显示的来源名。 */
export function pickSourceName(
  item: HasSourceName | null | undefined,
  language: LensLanguage,
): string | null {
  return pickLocalized(item?.displayName, item?.displayNameEn, language);
}
