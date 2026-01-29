import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Water Cup 💧",
  description: "Competição interna de água com ranking em tempo real."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="min-h-screen">
          <div className="mx-auto w-full max-w-lg px-4 py-6">{children}</div>
        </div>
      </body>
    </html>
  );
}

