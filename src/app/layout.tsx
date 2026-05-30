import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
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
  interactiveWidget: "resizes-visual",
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
            __html: `(function(){try{var k='mati:colorTheme',v=localStorage.getItem(k),a=['sage','berry','ocean','sunset','forest','lavender'];document.documentElement.setAttribute('data-mati-theme',a.includes(v)?v:'sage')}catch(e){}})();(function(){try{var r=document.documentElement,s=window.matchMedia('(display-mode: standalone)').matches,d=document.createElement('div');d.style.cssText='position:fixed;bottom:0;left:0;padding-bottom:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none';r.appendChild(d);var px=parseFloat(getComputedStyle(d).paddingBottom)||0;r.removeChild(d);var n=Math.round(px>0?px:(s?34:0));r.style.setProperty('--mati-safe-bottom-locked',n+'px')}catch(e){}})();`,
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
