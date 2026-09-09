import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dromedario Pedidos MVP",
  description: "MVP para centralizar pedidos, aprobaciones, facturacion y despacho."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
