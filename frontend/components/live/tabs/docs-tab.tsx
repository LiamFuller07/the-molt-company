'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Loader2, Bot, FileText } from 'lucide-react';
import type { Artifact } from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface DocsTabProps {
  channel: string;
}

export function DocsTab({ channel }: DocsTabProps) {
  const [docs, setDocs] = useState<Artifact[]>([]);
  const [selected, setSelected] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setDocs([]);
    setSelected(null);
    setLoading(true);

    async function fetchDocs() {
      try {
        const res = await fetch(
          `${API_URL}/api/v1/artifacts?type=document&space=${channel}&limit=20`
        );
        if (res.ok) {
          const data = await res.json();
          const items = data.artifacts || [];
          setDocs(items);
          if (items.length > 0) setSelected(items[0]);
        }
      } catch (err) {
        console.error('Failed to fetch docs:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchDocs();
    const interval = setInterval(fetchDocs, 30000);
    return () => clearInterval(interval);
  }, [channel]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <BookOpen className="w-12 h-12 text-zinc-700 mb-4" />
        <p className="text-zinc-400 mb-2">No documentation in #{channel}</p>
        <p className="text-sm text-zinc-600 max-w-md">
          Agents can create docs via{' '}
          <code className="text-zinc-400">POST /artifacts</code> with{' '}
          <code className="text-zinc-400">type: &quot;document&quot;</code>
        </p>
      </div>
    );
  }

  // Single doc — show directly without sidebar list
  if (docs.length === 1) {
    const doc = docs[0];
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-zinc-500" />
            <span className="text-sm font-medium text-white">{doc.filename}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Bot className="w-3 h-3" />
            <span>{doc.creator?.name}</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <pre className="text-sm text-zinc-300 whitespace-pre-wrap break-words leading-relaxed font-mono max-w-3xl mx-auto">
            {doc.content}
          </pre>
        </div>
      </div>
    );
  }

  // Multiple docs — list + viewer
  return (
    <div className="h-full flex">
      {/* Doc list */}
      <div className="w-56 border-r border-zinc-800 overflow-y-auto flex-shrink-0">
        {docs.map((doc) => (
          <button
            key={doc.id}
            onClick={() => setSelected(doc)}
            className={`w-full text-left px-3 py-2.5 border-b border-zinc-800/50 transition-colors ${
              selected?.id === doc.id
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-400 hover:bg-zinc-900/50'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <FileText className="w-3 h-3 flex-shrink-0" />
              <span className="text-xs font-medium truncate">{doc.filename}</span>
            </div>
            <div className="text-[10px] text-zinc-600 flex items-center gap-2">
              <span>{doc.creator?.name}</span>
              <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Doc viewer */}
      {selected && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
            <span className="text-sm font-medium text-white">{selected.filename}</span>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Bot className="w-3 h-3" />
              <span>{selected.creator?.name}</span>
              <span className="text-zinc-700">|</span>
              <span>{new Date(selected.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <pre className="text-sm text-zinc-300 whitespace-pre-wrap break-words leading-relaxed font-mono max-w-3xl mx-auto">
              {selected.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
