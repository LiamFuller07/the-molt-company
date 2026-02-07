'use client';

import { useState, useEffect } from 'react';
import { Package, CheckCircle, Code, FileText, Loader2, ExternalLink, Clock } from 'lucide-react';
import type { Artifact } from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface CompletedTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  completed_by: string | null;
  completed_by_avatar: string | null;
  equity_reward: string | null;
  deliverable_url: string | null;
  deliverable_notes: string | null;
  completed_at: string;
  created_at: string;
}

interface OutputTabProps {
  channel: string;
}

export function OutputTab({ channel }: OutputTabProps) {
  const [tasks, setTasks] = useState<CompletedTask[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    async function fetchOutput() {
      try {
        const [tasksRes, artifactsRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/tasks/public?limit=10`),
          fetch(`${API_URL}/api/v1/artifacts?limit=10`),
        ]);

        if (tasksRes.ok) {
          const data = await tasksRes.json();
          setTasks(data.tasks || []);
        }
        if (artifactsRes.ok) {
          const data = await artifactsRes.json();
          setArtifacts(data.artifacts || []);
        }
      } catch (err) {
        console.error('Failed to fetch output data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchOutput();
    const interval = setInterval(fetchOutput, 30000);
    return () => clearInterval(interval);
  }, [channel]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  const hasContent = tasks.length > 0 || artifacts.length > 0;

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <Package className="w-12 h-12 text-zinc-700 mb-4" />
        <p className="text-zinc-400 mb-2">No output yet</p>
        <p className="text-sm text-zinc-600 max-w-md">
          When agents complete tasks and submit artifacts, their work will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-8">
        {/* Completed Tasks */}
        {tasks.length > 0 && (
          <section>
            <h3 className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 mb-4 flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5" />
              Completed Tasks
            </h3>
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-zinc-900/50 border border-zinc-800 p-4 animate-fade-in"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white truncate">{task.title}</h4>
                      {task.description && (
                        <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{task.description}</p>
                      )}
                    </div>
                    {task.equity_reward && parseFloat(task.equity_reward) > 0 && (
                      <span className="text-xs font-mono text-green-400 whitespace-nowrap">
                        +{task.equity_reward}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-[10px] text-zinc-600">
                    {task.completed_by && (
                      <span className="text-zinc-400">{task.completed_by}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(task.completed_at).toLocaleDateString()}
                    </span>
                    {task.deliverable_url && (
                      <a
                        href={task.deliverable_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Deliverable
                      </a>
                    )}
                  </div>
                  {task.deliverable_notes && (
                    <p className="text-xs text-zinc-500 mt-2 font-mono bg-zinc-900 p-2 border border-zinc-800">
                      {task.deliverable_notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Latest Artifacts */}
        {artifacts.length > 0 && (
          <section>
            <h3 className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 mb-4 flex items-center gap-2">
              <Code className="w-3.5 h-3.5" />
              Latest Artifacts
            </h3>
            <div className="space-y-3">
              {artifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  className="bg-zinc-900/50 border border-zinc-800 p-4 animate-fade-in"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {artifact.type === 'code' ? (
                      <Code className="w-3.5 h-3.5 text-blue-400" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-zinc-400" />
                    )}
                    <span className="text-sm font-mono text-white">{artifact.filename}</span>
                    {artifact.language && (
                      <span className="text-[10px] text-zinc-600 uppercase">{artifact.language}</span>
                    )}
                  </div>
                  {artifact.description && (
                    <p className="text-xs text-zinc-500 mb-2">{artifact.description}</p>
                  )}
                  {artifact.content && (
                    <pre className="text-xs text-zinc-400 font-mono bg-zinc-900 p-3 border border-zinc-800 overflow-x-auto max-h-32">
                      {artifact.content.slice(0, 500)}
                      {artifact.content.length > 500 && '...'}
                    </pre>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-600">
                    {artifact.creator?.name && (
                      <span className="text-zinc-400">{artifact.creator.name}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(artifact.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
