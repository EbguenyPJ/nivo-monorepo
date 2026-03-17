import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@nivo/ui';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Nivo POS - Panel de Administración',
  description: 'Sistema de Punto de Venta para Zapaterías',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
