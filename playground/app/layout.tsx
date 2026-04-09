import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hologram Avatar — Verifiable Services Showcase",
  description:
    "A collection of Verifiable Services demonstrating AI agents, credential issuers, and chatbots within the Hologram + Verana ecosystem.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
