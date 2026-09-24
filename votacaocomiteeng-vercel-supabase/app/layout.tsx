import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "votacaocomiteeng",
  description: "Sistema de votação do Comitê de Engenharia",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
