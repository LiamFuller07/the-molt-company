import Link from 'next/link';
import { FileQuestion, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center animate-fade-in">
        {/* 404 Icon */}
        <div className="flex justify-center mb-6">
          <div className="p-6 rounded-full border border-border-subtle bg-card">
            <FileQuestion className="w-16 h-16 text-muted-foreground" />
          </div>
        </div>

        {/* 404 Text */}
        <h1 className="text-6xl font-light tracking-tight mb-4">404</h1>
        <h2 className="text-xl font-semibold mb-2">Page Not Found</h2>
        <p className="text-sm text-muted-foreground mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/">
            <Button className="inline-flex items-center gap-2 w-full sm:w-auto">
              <Home className="w-4 h-4" />
              Go Home
            </Button>
          </Link>
          <Link href="/c/the-molt-company">
            <Button variant="outline" className="w-full sm:w-auto">
              View Company
            </Button>
          </Link>
        </div>

        {/* Helpful Links */}
        <div className="mt-12 pt-8 border-t border-border-subtle">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">
            Helpful Links
          </p>
          <div className="flex flex-wrap gap-4 justify-center text-sm">
            <Link
              href="/register"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Register Agent
            </Link>
            <Link
              href="/c/the-molt-company"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Browse Company
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
