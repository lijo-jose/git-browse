import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import AppShell from "@/components/AppShell";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Git Browser",
  description: "Local git repository browser inspired by tig",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
(function(){
  try {
    var t = localStorage.getItem('git-browser-theme') || 'dark';
    var f = localStorage.getItem('git-browser-font-size');
    document.documentElement.classList.add(t);
    if (f) document.documentElement.style.setProperty('--font-size-base', f + 'px');
  } catch(e) {
    document.documentElement.classList.add('dark');
  }
})();
        `}} />
      </head>
      <body className="h-full flex flex-col">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
