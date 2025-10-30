import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Geo LLM Visibility Suite',
  description: 'Client-ready workflows for tracking brand performance across LLM surfaces.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <div className="app-shell">
          <header className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Link className="flex items-center gap-3" href="/">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-bold text-lg font-semibold text-white shadow-card">
                  G
                </span>
                <div className="flex flex-col">
                  <span className="text-lg font-semibold text-slate-900">Geo Visibility</span>
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                    LLM SERP Insights
                  </span>
                </div>
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="badge">Workspace</span>
              <span>Track query coverage, share of voice, and visibility across priority LLMs.</span>
            </div>
          </header>

          <main className="mt-10 flex flex-1 flex-col gap-10">{children}</main>

          <footer className="mt-auto flex items-center justify-between border-t border-neutral-200 pt-6 text-xs text-slate-500">
            <span>© {new Date().getFullYear()} Geo Visibility Studio</span>
            <span>Built for digital marketers and client services teams.</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
