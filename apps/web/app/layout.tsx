import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { HeaderBar } from "./_components/HeaderBar";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

// Runs synchronously in <head> before paint to avoid FOUC.
const themeInitScript = `(function(){try{
  var t=localStorage.getItem('tn:theme');
  if(t!=='dark'&&t!=='light') t='light';
  document.documentElement.setAttribute('data-theme',t);
  var d=localStorage.getItem('tn:density');
  if(d!=='compact'&&d!=='cozy'&&d!=='relaxed') d='cozy';
  document.documentElement.classList.add('density-'+d);
}catch(e){
  document.documentElement.setAttribute('data-theme','light');
  document.documentElement.classList.add('density-cozy');
}})();`;

export const metadata: Metadata = {
  title: "TraderNews — AI economic calendar for day traders",
  description:
    "Forex Factory–style calendar with AI explainers, historical reaction stats, and intraday volatility scores.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <div className="min-h-[100dvh]">
          <HeaderBar />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
