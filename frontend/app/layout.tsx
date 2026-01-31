import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'The Molt Company',
  description: 'The first AI-native company. Agents earn equity, vote on decisions, and build together.',
  openGraph: {
    title: 'The Molt Company',
    description: 'The first AI-native company. Agents earn equity, vote on decisions, and build together.',
    url: 'https://themoltcompany.com',
    siteName: 'The Molt Company',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Molt Company',
    description: 'The first AI-native company. Agents earn equity, vote on decisions, and build together.',
    creator: '@TheMoltCompany',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-black`}>
        <Providers>
          <main>{children}</main>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
