import { createLogger } from "@/lib/logger";
import iconv from "iconv-lite";

const logger = createLogger("monitor/detail-encoding");

const SUPPORTED_ENCODINGS = new Set([
  "utf-8",
  "utf8",
  "gbk",
  "gb2312",
  "gb18030",
  "big5",
  "big5-hkscs",
  "shift_jis",
  "shift-jis",
  "euc-jp",
]);

function normalizeEncoding(name: string): string {
  const lower = name.toLowerCase().trim().replace(/[_-]/g, "-");
  if (lower === "utf8") return "utf-8";
  if (lower === "gb2312" || lower === "gbk") return "gb18030";
  if (lower === "shift_jis" || lower === "sjis") return "shift-jis";
  return lower;
}

function extractCharsetFromContentType(contentType: string | null): string | null {
  if (!contentType) return null;
  const match = contentType.match(/charset\s*=\s*["']?([^"';\s]+)/i);
  return match ? match[1].trim() : null;
}

function extractCharsetFromMeta(html: string): string | null {
  const metaCharset = html.match(/<meta[^>]*charset\s*=\s*["']?([^"'>\s]+)/i);
  if (metaCharset) return metaCharset[1].trim();

  const httpEquiv = html.match(
    /<meta[^>]*http-equiv\s*=\s*["']content-type["'][^>]*content\s*=\s*["'][^"']*charset\s*=\s*([^"';\s]+)/i
  );
  if (httpEquiv) return httpEquiv[1].trim();

  const httpEquivReversed = html.match(
    /<meta[^>]*content\s*=\s*["'][^"']*charset\s*=\s*([^"';\s]+)[^"']*["'][^>]*http-equiv\s*=\s*["']content-type/i
  );
  if (httpEquivReversed) return httpEquivReversed[1].trim();

  return null;
}

function isLikelyGarbled(text: string): boolean {
  if (!text || text.length < 20) return false;

  const replacementCharCount = (text.match(/\uFFFD/g) || []).length;
  if (replacementCharCount > 0 && replacementCharCount / text.length > 0.05) {
    return true;
  }

  const weirdCharCount = (text.match(/[\u0080-\u00FF\u0100-\u017F]/g) || []).length;
  const cjkCharCount = (text.match(/[\u4E00-\u9FFF]/g) || []).length;
  if (weirdCharCount > 5 && weirdCharCount / Math.max(text.length, 1) > 0.1 && cjkCharCount > 0) {
    return true;
  }

  return false;
}

function safeDecode(buffer: Buffer, encoding: string): string | null {
  try {
    if (encoding === "utf-8" || encoding === "utf8") {
      return buffer.toString("utf-8");
    }
    if (iconv.encodingExists(encoding)) {
      return iconv.decode(buffer, encoding);
    }
    return null;
  } catch (e) {
    logger.warn("解码失败", {
      encoding,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

export type DecodeResult = {
  text: string;
  encoding: string;
  strategy: "content-type" | "html-meta" | "utf8-default" | "gb18030-fallback";
};

export async function decodeResponse(
  response: Response,
): Promise<DecodeResult> {
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "";

  const charsetFromHeader = extractCharsetFromContentType(contentType);
  if (charsetFromHeader) {
    const normalized = normalizeEncoding(charsetFromHeader);
    if (SUPPORTED_ENCODINGS.has(normalized)) {
      const text = safeDecode(buffer, normalized);
      if (text !== null) {
        logger.debug("使用 Content-Type 编码解码成功", {
          encoding: normalized,
          strategy: "content-type",
          contentLength: buffer.length,
          textLength: text.length,
          preview: text.slice(0, 80),
        });
        return { text, encoding: normalized, strategy: "content-type" };
      }
      logger.warn("Content-Type 指定编码解码失败，继续尝试其他方式", {
        encoding: normalized,
      });
    }
  }

  const headSample = buffer.slice(0, 2048).toString("latin1");
  const charsetFromMeta = extractCharsetFromMeta(headSample);
  if (charsetFromMeta) {
    const normalized = normalizeEncoding(charsetFromMeta);
    if (SUPPORTED_ENCODINGS.has(normalized)) {
      const text = safeDecode(buffer, normalized);
      if (text !== null) {
        logger.debug("使用 HTML meta 编码解码成功", {
          encoding: normalized,
          strategy: "html-meta",
          contentLength: buffer.length,
          textLength: text.length,
          preview: text.slice(0, 80),
        });
        return { text, encoding: normalized, strategy: "html-meta" };
      }
      logger.warn("HTML meta 指定编码解码失败，继续尝试其他方式", {
        encoding: normalized,
      });
    }
  }

  const utf8Text = buffer.toString("utf-8");

  if (!isLikelyGarbled(utf8Text)) {
    logger.debug("使用默认 UTF-8 解码", {
      encoding: "utf-8",
      strategy: "utf8-default",
      contentLength: buffer.length,
      textLength: utf8Text.length,
      preview: utf8Text.slice(0, 80),
    });
    return { text: utf8Text, encoding: "utf-8", strategy: "utf8-default" };
  }

  logger.debug("UTF-8 解码疑似乱码，尝试 GB18030 回退", {
    contentLength: buffer.length,
    preview: utf8Text.slice(0, 80),
  });

  const gbText = safeDecode(buffer, "gb18030");
  if (gbText !== null && !isLikelyGarbled(gbText) && gbText.length > 0) {
    logger.debug("GB18030 回退解码成功", {
      encoding: "gb18030",
      strategy: "gb18030-fallback",
      contentLength: buffer.length,
      textLength: gbText.length,
      preview: gbText.slice(0, 80),
    });
    return { text: gbText, encoding: "gb18030", strategy: "gb18030-fallback" };
  }

  logger.warn("所有编码策略均失败，返回 UTF-8 结果", {
    contentLength: buffer.length,
  });
  return { text: utf8Text, encoding: "utf-8", strategy: "utf8-default" };
}

export const _testExports = {
  extractCharsetFromContentType,
  extractCharsetFromMeta,
  normalizeEncoding,
  isLikelyGarbled,
  safeDecode,
};
