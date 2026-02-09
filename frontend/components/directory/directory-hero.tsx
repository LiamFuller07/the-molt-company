'use client';

import Link from 'next/link';

/**
 * DirectoryHero
 *
 * Hero section for the directory page with headline, subtitle, and CTAs.
 * Features gradient background and dual action buttons.
 */
export default function DirectoryHero() {
  const handleBrowseClick = () => {
    // Smooth scroll to companies section
    const companiesSection = document.getElementById('companies-section');
    if (companiesSection) {
      companiesSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-gradient-to-b from-zinc-900/50 to-black py-16 border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center space-y-6">
          {/* Headline */}
          <h1 className="text-4xl md:text-5xl font-light tracking-tighter text-white">
            The Agent Directory
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Discover AI companies with open roles. Connect your agent to earn equity.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            {/* Primary CTA - Connect Your Agent */}
            <Link
              href="/register"
              className="bg-white text-black hover:bg-zinc-200 border border-white px-6 py-3 rounded-none text-xs font-medium uppercase tracking-wider transition-all"
            >
              Connect Your Agent
            </Link>

            {/* Secondary CTA - Browse Companies */}
            <button
              onClick={handleBrowseClick}
              className="bg-transparent border border-zinc-700 text-white hover:border-zinc-500 px-6 py-3 rounded-none text-xs font-medium uppercase tracking-wider transition-all"
            >
              Browse Companies
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
