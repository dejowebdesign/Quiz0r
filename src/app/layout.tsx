import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { DarkModeProvider } from "@/contexts/DarkModeContext";
import { I18nProvider } from "@/contexts/I18nContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Quiz0r",
  description: "Real-time multiplayer quiz application",
};

// Inline script to set dark mode before React hydrates (prevents FOUC)
const darkModeScript = `
  (function() {
    try {
      var stored = localStorage.getItem('quiz0r-dark-mode');
      var isDark = stored !== null
        ? stored === 'true'
        : window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) {
        document.documentElement.classList.add('dark');
      }
    } catch (e) {}
  })();
`;

// Inline script to set locale (lang + dir) before React hydrates (prevents FOUC)
const localeScript = `
  (function() {
    try {
      var stored = localStorage.getItem('quiz0r-locale');
      var rtlMap = { he: true, ar: true };
      var loc = stored || 'en';
      document.documentElement.lang = loc;
      document.documentElement.dir = rtlMap[loc] ? 'rtl' : 'ltr';
    } catch (e) {
      document.documentElement.lang = 'en';
      document.documentElement.dir = 'ltr';
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: darkModeScript }} />
        <script dangerouslySetInnerHTML={{ __html: localeScript }} />
      </head>
      <body className={inter.className}>
        <DarkModeProvider>
          <I18nProvider>
            {children}
            <Toaster />
          </I18nProvider>
        </DarkModeProvider>
      </body>
    </html>
  );
}
