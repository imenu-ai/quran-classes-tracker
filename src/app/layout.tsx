import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quran Classes Tracker",
};

// Placeholder: lang/dir come from the locale helper in step 1.6.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
