import type { Metadata } from "next";
import { Inter, Literata } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const literata = Literata({
  subsets: ["latin"],
  variable: "--font-literata",
});

export const metadata: Metadata = {
  title: "Lectores - Comunidades de lectura",
  description: "Plataforma privada para comunidades de lectores",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${literata.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
