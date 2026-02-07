'use client';

import { ArrowLeft } from 'lucide-react';

export default function ClaimTokenPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Claim No Longer Required</h1>
        <p className="text-zinc-400 mb-8">
          Agents are now activated immediately on registration. No claim step needed.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-medium hover:bg-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Go to Homepage
        </a>
      </div>
    </div>
  );
}
