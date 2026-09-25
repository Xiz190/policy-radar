import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { copyToClipboard, shareOrCopy } from "@/lib/clipboard";

describe("clipboard - copyToClipboard", () => {
  let writeTextSpy: ReturnType<typeof vi.fn>;
  let execCommandSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeTextSpy = vi.fn().mockResolvedValue(undefined);
    execCommandSpy = vi.fn().mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("现代浏览器（clipboard API + 安全上下文）", () => {
    beforeEach(() => {
      vi.stubGlobal("navigator", {
        clipboard: { writeText: writeTextSpy },
      });
      vi.stubGlobal("window", { isSecureContext: true });
    });

    it("调用 navigator.clipboard.writeText 并返回 true", async () => {
      const result = await copyToClipboard("hello world");
      expect(result).toBe(true);
      expect(writeTextSpy).toHaveBeenCalledTimes(1);
      expect(writeTextSpy).toHaveBeenCalledWith("hello world");
    });

    it("复制成功时调用 onSuccess 回调", async () => {
      const onSuccess = vi.fn();
      const onError = vi.fn();
      const result = await copyToClipboard("test", { onSuccess, onError });
      expect(result).toBe(true);
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    });

    it("复制失败时返回 false 并调用 onError", async () => {
      writeTextSpy.mockRejectedValue(new Error("denied"));
      const onSuccess = vi.fn();
      const onError = vi.fn();
      const result = await copyToClipboard("test", { onSuccess, onError });
      expect(result).toBe(false);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe("旧浏览器兜底（execCommand）", () => {
    let taValue: string;
    let taStyle: Record<string, string>;
    let taFocus: ReturnType<typeof vi.fn>;
    let taSelect: ReturnType<typeof vi.fn>;
    let taRemove: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      taValue = "";
      taStyle = {};
      taFocus = vi.fn();
      taSelect = vi.fn();
      taRemove = vi.fn();

      const taMock = {
        get value() { return taValue; },
        set value(v: string) { taValue = v; },
        style: new Proxy(taStyle, {
          set(target, key, val) {
            target[String(key)] = val;
            return true;
          },
        }),
        focus: taFocus,
        select: taSelect,
        remove: taRemove,
      };

      const appendChildSpy = vi.fn();
      const createElementSpy = vi.fn().mockReturnValue(taMock);

      vi.stubGlobal("navigator", {});
      vi.stubGlobal("window", { isSecureContext: false });
      vi.stubGlobal("document", {
        createElement: createElementSpy,
        body: { appendChild: appendChildSpy },
        execCommand: execCommandSpy,
      });
    });

    it("非安全上下文时走 execCommand 兜底", async () => {
      const result = await copyToClipboard("fallback text");
      expect(result).toBe(true);
      expect(taValue).toBe("fallback text");
      expect(taStyle.position).toBe("fixed");
      expect(taStyle.opacity).toBe("0");
      expect(taFocus).toHaveBeenCalled();
      expect(taSelect).toHaveBeenCalled();
      expect(execCommandSpy).toHaveBeenCalledWith("copy");
      expect(taRemove).toHaveBeenCalled();
    });

    it("execCommand 返回 false 时仍返回 true（兜底无精确失败检测）", async () => {
      execCommandSpy.mockReturnValue(false);
      const result = await copyToClipboard("test");
      expect(result).toBe(true);
    });
  });
});

describe("clipboard - shareOrCopy", () => {
  let writeTextSpy: ReturnType<typeof vi.fn>;
  let shareSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeTextSpy = vi.fn().mockResolvedValue(undefined);
    shareSpy = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setupWithShare() {
    vi.stubGlobal("navigator", {
      share: shareSpy,
      clipboard: { writeText: writeTextSpy },
    });
    vi.stubGlobal("window", { isSecureContext: true });
  }

  function setupNoShare() {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: writeTextSpy },
    });
    vi.stubGlobal("window", { isSecureContext: true });
  }

  it("支持 share 时优先调用 navigator.share，返回 'share'", async () => {
    setupWithShare();
    const result = await shareOrCopy({
      title: "测试标题",
      text: "测试文本",
      url: "https://example.com",
    });
    expect(result).toBe("share");
    expect(shareSpy).toHaveBeenCalledTimes(1);
    expect(shareSpy).toHaveBeenCalledWith({
      title: "测试标题",
      text: "测试文本",
      url: "https://example.com",
    });
    expect(writeTextSpy).not.toHaveBeenCalled();
  });

  it("用户取消分享时回退到复制，返回 'copy'", async () => {
    setupWithShare();
    shareSpy.mockRejectedValue(new Error("cancelled"));
    const result = await shareOrCopy({ url: "https://example.com" });
    expect(result).toBe("copy");
    expect(shareSpy).toHaveBeenCalledTimes(1);
    expect(writeTextSpy).toHaveBeenCalledWith("https://example.com");
  });

  it("不支持 share 时直接复制 URL，返回 'copy'", async () => {
    setupNoShare();
    const result = await shareOrCopy({ url: "https://example.com" });
    expect(result).toBe("copy");
    expect(writeTextSpy).toHaveBeenCalledWith("https://example.com");
  });

  it("复制失败时返回 'error'", async () => {
    setupNoShare();
    writeTextSpy.mockRejectedValue(new Error("fail"));
    const result = await shareOrCopy({ url: "https://example.com" });
    expect(result).toBe("error");
  });

  it("复制成功时调用 onCopySuccess", async () => {
    setupNoShare();
    const onCopySuccess = vi.fn();
    const onCopyError = vi.fn();
    await shareOrCopy({ url: "https://example.com", onCopySuccess, onCopyError });
    expect(onCopySuccess).toHaveBeenCalledTimes(1);
    expect(onCopyError).not.toHaveBeenCalled();
  });

  it("分享失败 + 复制失败时调用 onCopyError", async () => {
    setupWithShare();
    shareSpy.mockRejectedValue(new Error("cancelled"));
    writeTextSpy.mockRejectedValue(new Error("fail"));
    const onCopySuccess = vi.fn();
    const onCopyError = vi.fn();
    const result = await shareOrCopy({ url: "https://example.com", onCopySuccess, onCopyError });
    expect(result).toBe("error");
    expect(onCopyError).toHaveBeenCalledTimes(1);
    expect(onCopySuccess).not.toHaveBeenCalled();
  });
});
