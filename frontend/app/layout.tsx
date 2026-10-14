import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { Providers } from "./components/providers";
import { ConfirmProvider } from "./components/confirm-dialog";
import { PwaRegister } from "./components/pwa";

export const metadata: Metadata = {
  title: "EYK",
  description: "Plataforma educacional EYK.",
  applicationName: "EYK",
  appleWebApp: { capable: true, title: "EYK", statusBarStyle: "black-translucent" },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <body>
        <ConfirmProvider>
          <Providers>{children}</Providers>
          <Toaster richColors position="top-right" />
          <PwaRegister />
        </ConfirmProvider>
      </body>
    </html>
  );
}