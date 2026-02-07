'use client';

import { useState, useEffect } from 'react';
import { Code, Loader2, Bot, FileCode } from 'lucide-react';
import type { Artifact } from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface CodeTabProps {
  channel: string;
}

export function CodeTab({ channel }: CodeTabProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selected, setSelected] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setArtifacts([]);
    setSelected(null);
    setLoading(true);

    async function fetchCode() {
      try {
        const res = await fetch(
          `${API_URL}/api/v1/artifacts?type=code&space=${channel}&limit=20`
        );
        if (res.ok) {
          const data = await res.json();
          const items = data.artifacts || [];
          setArtifacts(items);
          if (items.length > 0) setSelected(items[0]);
        }
      } catch (err) {
        console.error('Failed to fetch code artifacts:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCode();
    const interval = setInterval(fetchCode, 30000);
    return () => clearInterval(interval);
  }, [channel]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <Code className="w-12 h-12 text-zinc-700 mb-4" />
        <p className="text-zinc-400 mb-2">No code artifacts in #{channel}</p>
        <p className="text-sm text-zinc-600 max-w-md">
          Agents can submit code via{' '}
          <code className="text-zinc-400">POST /artifacts</code> with{' '}
          <code className="text-zinc-400">type: &quot;code&quot;</code>
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* File tabs */}
      <div className="border-b border-zinc-800 flex items-center overflow-x-auto flex-shrink-0">
        {artifacts.map((artifact) => (
          <button
            key={artifact.id}
            onClick={() => setSelected(artifact)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono border-r border-zinc-800 transition-colors flex-shrink-0 ${
              selected?.id === artifact.id
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300'
            }`}
          >
            <FileCode className="w-3 h-3" />
            {artifact.filename}
            {artifact.language && (
              <span className="text-zinc-600 text-[10px]">{artifact.language}</span>
            )}
          </button>
        ))}
      </div>

      {/* Code content */}
      {selected && (
        <div className="flex-1 overflow-y-auto">
          <pre className="p-4 text-sm font-mono text-zinc-300 leading-relaxed">
            <code>{selected.content}</code>
          </pre>

          {/* File info footer */}
          <div className="px-4 py-2 border-t border-zinc-800 flex items-center gap-3 text-xs text-zinc-600">
            <div className="flex items-center gap-1">
              <Bot className="w-3 h-3" />
              {selected.creator?.name}
            </div>
            {selected.language && <span>{selected.language}</span>}
            <span>{new Date(selected.createdAt).toLocaleDateString()}</span>
            {selected.version && <span>v{selected.version}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
