import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import { appChromeBootScript } from "@/lib/pwa/safe-area-bottom";
import { ThemeProvider } from "@/providers/theme-provider";
import { QueryProvider } from "@/providers/query-provider";
import { MatiThemeApplier } from "@/components/theme/mati-theme-applier";
import { ThemeColorSync } from "@/components/theme/theme-color-sync";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Mati",
  description: "Gemensamma inköpslistor för hushållet",
  applicationName: "Mati",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mati",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#F0F4EF",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "overlays-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv" suppressHydrationWarning data-mati-theme="sage">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='mati:colorTheme',v=localStorage.getItem(k),a=['sage','berry','ocean','sunset','forest','lavender'];document.documentElement.setAttribute('data-mati-theme',a.includes(v)?v:'sage')}catch(e){}})();${appChromeBootScript()}`,
          }}
        />
      </head>
      <body className={`${dmSans.variable} font-sans antialiased`}>
        <ThemeProvider>
          <MatiThemeApplier />
          <ThemeColorSync />
          <QueryProvider>{children}</QueryProvider>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
