"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { usePrefs } from "@/contexts/prefs-context";
import { useT } from "@/lib/i18n";

// 作者登录页：演示站上输一次口令，这台设备就能用全部功能（收藏、备注、手机→桌面交接等）
export default function UnlockPage() {
  const { language } = usePrefs();
  const t = useT(language);
  const [owner, setOwner] = useState<boolean | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);
  // 从作者专属页被跳过来时带着 ?next=：登录后回到那一页。只接受站内路径，防止被拿去跳到外站
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("next");
    if (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")) setNext(raw);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((me: { owner?: boolean }) => setOwner(!!me.owner))
      .catch(() => setOwner(false));
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim() || busy) return;
    setBusy(true);
    setWrong(false);
    try {
      const res = await fetch("/api/auth/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      if (res.ok) {
        // 整页跳转，让顶部的只读提示条按新身份重新判断
        window.location.href = next ?? "/";
        return;
      }
      setWrong(true);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/unlock", { method: "DELETE" });
    window.location.href = "/";
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <h1 className="font-serif text-2xl text-[var(--foreground)]">{t("demo.unlock.title")}</h1>

      {owner ? (
        <div className="mt-4 space-y-4 text-sm text-[var(--muted-foreground)]">
          <p>{t("demo.unlock.signedIn")}</p>
          <div className="flex gap-3">
            <Link href="/" className="rounded-md bg-[var(--primary)] px-4 py-2 text-[var(--primary-foreground)]">
              {t("demo.unlock.back")}
            </Link>
            <button onClick={signOut} className="rounded-md border border-[var(--border)] px-4 py-2 text-[var(--foreground)] hover:bg-[var(--muted)]">
              {t("demo.unlock.signOut")}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={signIn} className="mt-4 space-y-3">
          {next && <p className="text-sm text-[var(--foreground)]">{t("demo.unlock.ownerOnly")}</p>}
          <p className="text-sm text-[var(--muted-foreground)]">{t("demo.unlock.desc")}</p>
          <input
            type="password"
            autoComplete="current-password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={t("demo.unlock.placeholder")}
            aria-invalid={wrong}
            className="w-full rounded-md border border-[var(--input)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--ring)]"
          />
          {wrong && <p role="alert" className="text-xs text-[var(--destructive)]">{t("demo.unlock.wrong")}</p>}
          <button
            type="submit"
            disabled={busy || !token.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm text-[var(--primary-foreground)] disabled:opacity-50"
          >
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {t("demo.unlock.submit")}
          </button>
          <Link href="/" className="block pt-2 text-center text-xs text-[var(--muted-foreground)] hover:underline">
            {t("demo.unlock.back")}
          </Link>
        </form>
      )}
    </main>
  );
}
