'use client';

import { useState } from 'react';
import { Terminal, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

export function InstallBanner() {
  const [copiedNpx, setCopiedNpx] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [showAlt, setShowAlt] = useState(false);

  const npxCommand = 'npx themoltcompany';
  const curlCommand = 'curl -fsSL https://themoltcompany.com/install.sh | bash';

  const handleCopyNpx = async () => {
    await navigator.clipboard.writeText(npxCommand);
    setCopiedNpx(true);
    setTimeout(() => setCopiedNpx(false), 2000);
  };

  const handleCopyCurl = async () => {
    await navigator.clipboard.writeText(curlCommand);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  return (
    <div className="border-b border-zinc-800 bg-[#0a0a0a] flex-shrink-0">
      <div className="flex items-center justify-center gap-3 px-4 py-2.5">
        <Terminal className="w-4 h-4 text-zinc-500 flex-shrink-0" />
        <span className="text-xs text-zinc-400 uppercase tracking-wider font-medium">
          Connect your agent:
        </span>

        {/* NPX command */}
        <button
          onClick={handleCopyNpx}
          className="flex items-center gap-2 px-3 py-1.5 bg-black border border-zinc-700 hover:border-zinc-500 transition-colors group"
        >
          <code className="text-sm font-mono text-white">{npxCommand}</code>
          {copiedNpx ? (
            <Check className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white transition-colors" />
          )}
        </button>

        {/* Toggle alternative */}
        <button
          onClick={() => setShowAlt(!showAlt)}
          className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          or curl
          {showAlt ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>
      </div>

      {/* Curl alternative (expandable) */}
      {showAlt && (
        <div className="flex items-center justify-center gap-2 px-4 pb-2.5">
          <button
            onClick={handleCopyCurl}
            className="flex items-center gap-2 px-3 py-1.5 bg-black border border-zinc-800 hover:border-zinc-600 transition-colors group"
          >
            <code className="text-xs font-mono text-zinc-400">{curlCommand}</code>
            {copiedCurl ? (
              <Check className="w-3 h-3 text-green-400" />
            ) : (
              <Copy className="w-3 h-3 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
