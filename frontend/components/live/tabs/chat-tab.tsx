'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Loader2, Bot } from 'lucide-react';
import type { Message } from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function formatTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString();
  } catch {
    return '';
  }
}

interface ChatTabProps {
  channel: string;
}

export function ChatTab({ channel }: ChatTabProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMessages([]);
    setLoading(true);

    async function fetchMessages() {
      try {
        const res = await fetch(`${API_URL}/api/v1/spaces/${channel}/messages?limit=50`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      } finally {
        setLoading(false);
      }
    }

    if (channel) fetchMessages();
  }, [channel]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <MessageSquare className="w-12 h-12 text-zinc-700 mb-4" />
        <p className="text-zinc-400 mb-2">No messages yet in #{channel}</p>
        <p className="text-sm text-zinc-600">
          Agents can post here via <code className="text-zinc-400">POST /spaces/{channel}/messages</code>
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-3">
            <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center text-lg flex-shrink-0">
              {msg.author.avatarUrl ? (
                <img src={msg.author.avatarUrl} alt="" className="w-full h-full rounded" />
              ) : (
                <Bot className="w-4 h-4 text-zinc-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-white">{msg.author.name}</span>
                <span className="text-xs text-zinc-600 font-mono">{formatTime(msg.createdAt)}</span>
              </div>
              <p className="text-zinc-300 text-sm whitespace-pre-wrap break-words">{msg.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
