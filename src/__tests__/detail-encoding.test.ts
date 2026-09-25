import { describe, it, expect } from "vitest";
import iconv from "iconv-lite";
import { _testExports, decodeResponse } from "@/lib/monitor/detail-encoding";

const {
  extractCharsetFromContentType,
  extractCharsetFromMeta,
  normalizeEncoding,
  isLikelyGarbled,
  safeDecode,
} = _testExports;

describe("detail-encoding - normalizeEncoding", () => {
  it("标准化常见编码名称", () => {
    expect(normalizeEncoding("UTF-8")).toBe("utf-8");
    expect(normalizeEncoding("utf8")).toBe("utf-8");
    expect(normalizeEncoding("GBK")).toBe("gb18030");
    expect(normalizeEncoding("gb2312")).toBe("gb18030");
    expect(normalizeEncoding("GB18030")).toBe("gb18030");
    expect(normalizeEncoding("Shift_JIS")).toBe("shift-jis");
    expect(normalizeEncoding("shift_jis")).toBe("shift-jis");
  });
});

describe("detail-encoding - extractCharsetFromContentType", () => {
  it("从 Content-Type 中提取 charset", () => {
    expect(extractCharsetFromContentType("text/html; charset=utf-8")).toBe("utf-8");
    expect(extractCharsetFromContentType("text/html; charset=GBK")).toBe("GBK");
    expect(extractCharsetFromContentType('text/html; charset="gb2312"')).toBe("gb2312");
    expect(extractCharsetFromContentType("text/html;Charset=UTF-8")).toBe("UTF-8");
  });

  it("没有 charset 时返回 null", () => {
    expect(extractCharsetFromContentType("text/html")).toBeNull();
    expect(extractCharsetFromContentType("")).toBeNull();
    expect(extractCharsetFromContentType(null)).toBeNull();
  });
});

describe("detail-encoding - extractCharsetFromMeta", () => {
  it("从 <meta charset> 中提取编码", () => {
    expect(extractCharsetFromMeta('<meta charset="utf-8">')).toBe("utf-8");
    expect(extractCharsetFromMeta('<meta charset="GBK">')).toBe("GBK");
    expect(extractCharsetFromMeta("<meta charset='gb2312' />")).toBe("gb2312");
  });

  it("从 <meta http-equiv content-type> 中提取编码", () => {
    const html1 = '<meta http-equiv="Content-Type" content="text/html; charset=gb2312">';
    expect(extractCharsetFromMeta(html1)).toBe("gb2312");

    const html2 = '<META HTTP-EQUIV="content-type" CONTENT="text/html; charset=GBK">';
    expect(extractCharsetFromMeta(html2)).toBe("GBK");
  });

  it("没有 meta charset 时返回 null", () => {
    expect(extractCharsetFromMeta("<html><head><title>test</title></head>")).toBeNull();
    expect(extractCharsetFromMeta("")).toBeNull();
  });
});

describe("detail-encoding - isLikelyGarbled", () => {
  it("正常中文文本不被判定为乱码", () => {
    const text = "这是一段正常的中文文本，用于测试乱码检测功能是否正常工作。";
    expect(isLikelyGarbled(text)).toBe(false);
  });

  it("空文本或短文本不判定为乱码", () => {
    expect(isLikelyGarbled("")).toBe(false);
    expect(isLikelyGarbled("hello")).toBe(false);
  });

  it("含有大量替换字符（U+FFFD）的文本判定为乱码", () => {
    const garbled = "\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD这是一段乱码的测试文本用于检测";
    expect(isLikelyGarbled(garbled)).toBe(true);
  });
});

describe("detail-encoding - safeDecode", () => {
  it("正确解码 UTF-8", () => {
    const text = "中文测试 UTF-8";
    const buffer = Buffer.from(text, "utf-8");
    const result = safeDecode(buffer, "utf-8");
    expect(result).toBe(text);
  });

  it("正确解码 GBK/GB18030", () => {
    const text = "玩转AI巧经营：看小店如何搭上“手搓经济”快车逆袭翻盘";
    const buffer = iconv.encode(text, "gb18030");
    const result = safeDecode(buffer, "gb18030");
    expect(result).toBe(text);
  });

  it("不支持的编码返回 null", () => {
    const buffer = Buffer.from("test");
    const result = safeDecode(buffer, "unknown-encoding-xyz");
    expect(result).toBeNull();
  });
});

describe("detail-encoding - decodeResponse", () => {
  it("正确解码 UTF-8 编码的响应", async () => {
    const text = "这是一段 UTF-8 编码的中文测试文本。";
    const buffer = Buffer.from(text, "utf-8");
    const response = new Response(buffer, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });

    const result = await decodeResponse(response);
    expect(result.encoding).toBe("utf-8");
    expect(result.strategy).toBe("content-type");
    expect(result.text).toBe(text);
  });

  it("正确解码 GB18030 编码的响应（Content-Type 指定）", async () => {
    const text = "玩转AI巧经营：看小店如何搭上“手搓经济”快车逆袭翻盘";
    const buffer = iconv.encode(text, "gb18030");
    const response = new Response(Buffer.from(buffer), {
      headers: { "Content-Type": "text/html; charset=gbk" },
    });

    const result = await decodeResponse(response);
    expect(result.encoding).toBe("gb18030");
    expect(result.strategy).toBe("content-type");
    expect(result.text).toBe(text);
  });

  it("从 HTML meta charset 推断编码", async () => {
    const bodyText = "中文内容测试";
    const html = `<html><head><meta charset="gbk"></head><body>${bodyText}</body></html>`;
    const buffer = iconv.encode(html, "gb18030");
    const response = new Response(Buffer.from(buffer), {
      headers: { "Content-Type": "text/html" },
    });

    const result = await decodeResponse(response);
    expect(result.encoding).toBe("gb18030");
    expect(result.strategy).toBe("html-meta");
    expect(result.text).toContain(bodyText);
  });

  it("UTF-8 响应且无 charset 时默认使用 utf-8", async () => {
    const text = "This is a normal English and 中文混合文本。";
    const buffer = Buffer.from(text, "utf-8");
    const response = new Response(buffer, {
      headers: { "Content-Type": "text/html" },
    });

    const result = await decodeResponse(response);
    expect(result.encoding).toBe("utf-8");
    expect(result.strategy).toBe("utf8-default");
    expect(result.text).toBe(text);
  });

  it("GBK 编码但无 charset 声明时，通过乱码检测 fallback 到 gb18030", async () => {
    const text = "玩转AI巧经营：看小店如何搭上“手搓经济”快车逆袭翻盘。这是一段较长的中文文本，用于测试乱码检测的 fallback 逻辑是否能正确识别并回退到 GB18030 编码。中国新闻网的常见编码问题测试。更多内容填充使得文本足够长以触发检测。";
    const buffer = iconv.encode(text, "gb18030");
    const response = new Response(Buffer.from(buffer), {
      headers: { "Content-Type": "text/html" },
    });

    const result = await decodeResponse(response);
    expect(result.encoding).toBe("gb18030");
    expect(result.text).toBe(text);
  });
});
