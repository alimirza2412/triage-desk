import type { Metadata } from "next";

import "@fontsource-variable/manrope";
import "@fontsource/noto-nastaliq-urdu/400.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Triage Desk",
  description: "AI support inbox for English, Urdu and Roman Urdu customer messages",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-[1520px] p-2 sm:p-4 lg:p-6">
          <div className="rounded-[32px] bg-sage p-2.5 sm:p-3 lg:rounded-[40px]">{children}</div>
        </div>
      </body>
    </html>
  );
}
