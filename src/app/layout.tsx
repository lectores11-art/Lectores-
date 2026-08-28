import type { Metadata } from "next";
import { Space_Grotesk, Literata } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const literata = Literata({
  subsets: ["latin"],
  variable: "--font-literata",
});

export const metadata: Metadata = {
  title: "Hilo de Letras - Comunidades de lectura",
  description: "Plataforma privada para comunidades de lectura",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="light">
      <body className={`${spaceGrotesk.variable} ${literata.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
