import { SiteHeader } from "@/components/site-header";
import { NotificationsClient } from "@/components/notifications-client";
import { LocalDataNotice } from "@/components/local-data-notice";
import { LOCAL_DATA_NOTICE } from "@/lib/local-data-notice";
import {
  Bell,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default function NotificationsPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />

      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-6">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Bell className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
            <span>通知中心</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            你的通知
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            关注的机构和关键词有新动态时，会在这里提醒你
          </p>
        </section>

        <NotificationsClient />

        <footer className="mt-12 border-t border-slate-200 pt-6 pb-4">
          <LocalDataNotice
            variant="footer"
            dismissible={false}
            showSecondaryAction
            customText={LOCAL_DATA_NOTICE.notifications.footerText}
            secondaryActionHref="/subscribe"
          />
        </footer>
      </div>
    </main>
  );
}
