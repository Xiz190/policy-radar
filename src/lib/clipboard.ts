type CopyOptions = {
  onSuccess?: () => void;
  onError?: () => void;
};

export async function copyToClipboard(text: string, options: CopyOptions = {}): Promise<boolean> {
  const { onSuccess, onError } = options;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    onSuccess?.();
    return true;
  } catch {
    onError?.();
    return false;
  }
}

type ShareOptions = {
  title?: string;
  text?: string;
  url: string;
  onCopySuccess?: () => void;
  onCopyError?: () => void;
};

export async function shareOrCopy(options: ShareOptions): Promise<"share" | "copy" | "error"> {
  const { title, text, url, onCopySuccess, onCopyError } = options;

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return "share";
    } catch {
      // 用户取消分享，走复制兜底
    }
  }

  const ok = await copyToClipboard(url, {
    onSuccess: onCopySuccess,
    onError: onCopyError,
  });

  return ok ? "copy" : "error";
}
