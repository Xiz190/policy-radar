import type { Metadata, Viewport } from "next";
import { Newsreader, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ChatbotWidget } from "@/components/chatbot/ChatbotWidget";
import { PrefsProvider } from "@/contexts/prefs-context";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { NavigationProgress } from "@/components/navigation-progress";

// 编辑台字体系统：衬线标题(Newsreader) + 无衬线正文(IBM Plex Sans) + 等宽数据(IBM Plex Mono)
const serif = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
});

const sans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const mono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "政策雷达",
  description: "政策雷达 —— 领域无关情报引擎的政策实例：把「找 → 核实 → 关联 → 分析」半自动化，一台引擎换个领域就能扫不同信号",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "雷达",
  },
};

export const viewport: Viewport = {
  themeColor: "#1f5e7e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${serif.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col pb-16 sm:pb-0">
        <PrefsProvider>
          <NavigationProgress />
          {children}
          <ChatbotWidget />
          <MobileBottomNav />
          <ServiceWorkerRegistration />
        </PrefsProvider>
      </body>
    </html>
  );
}
