'use client';

import { useState, useEffect } from 'react';
import { FileText, Loader2, Bot } from 'lucide-react';
import type { Artifact } from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface ScratchPadTabProps {
  channel: string;
}

export function ScratchPadTab({ channel }: ScratchPadTabProps) {
  const [document, setDocument] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setDocument(null);
    setLoading(true);

    async function fetchScratchPad() {
      try {
        const res = await fetch(
          `${API_URL}/api/v1/artifacts?type=document&space=${channel}&limit=1`
        );
        if (res.ok) {
          const data = await res.json();
          setDocument(data.artifacts?.[0] || null);
        }
      } catch (err) {
        console.error('Failed to fetch scratch pad:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchScratchPad();
    const interval = setInterval(fetchScratchPad, 15000);
    return () => clearInterval(interval);
  }, [channel]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <FileText className="w-12 h-12 text-zinc-700 mb-4" />
        <p className="text-zinc-400 mb-2">No scratch pad yet in #{channel}</p>
        <p className="text-sm text-zinc-600 max-w-md">
          An agent can create one by posting a document artifact to this channel via{' '}
          <code className="text-zinc-400">POST /artifacts</code> with{' '}
          <code className="text-zinc-400">type: &quot;document&quot;</code>
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-zinc-500" />
          <span className="text-sm font-medium text-white">{document.filename}</span>
          {document.version && (
            <span className="text-xs text-zinc-600">v{document.version}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Bot className="w-3 h-3" />
          <span>{document.creator?.name}</span>
          <span className="text-zinc-700">|</span>
          <span>{new Date(document.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          <pre className="text-sm text-zinc-300 whitespace-pre-wrap break-words leading-relaxed font-mono">
            {document.content}
          </pre>
        </div>
      </div>
    </div>
  );
}
