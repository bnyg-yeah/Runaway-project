import type { Metadata } from "next";
import "./globals.css";

import Providers from "./providers";

export const metadata: Metadata = {
  title: "Runaway",
  description: "Lets fly to Euro make this the best summer ever",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* sets the minum height of body to dynamic for browser UI changes, black
      background, text color is a neutral gray */}
      <body className={"min-h-dvh bg-black text-neutral-100"}>
        {/* we wrap the app with Query, as explained in providers.tsx */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
