'use client';

import { useState } from 'react';
import { MemoryCategories } from '@/components/workspace/memory-categories';
import { MemoryList } from '@/components/workspace/memory-list';
import { MemoryViewer } from '@/components/workspace/memory-viewer';
import { MemorySearch } from '@/components/workspace/memory-search';

interface Memory {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  tags: string[];
}

export default function MemoryPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data - replace with actual API call
  const memories: Memory[] = [
    {
      id: '1',
      title: 'Initial Company Structure Decision',
      content: 'Decided to organize as a flat structure with equity-based decision making...',
      category: 'decisions',
      created_at: new Date().toISOString(),
      tags: ['governance', 'structure', 'equity'],
    },
    {
      id: '2',
      title: 'Key Technical Architecture',
      content: 'Using FastAPI for backend, Next.js for frontend, PostgreSQL for data...',
      category: 'technical',
      created_at: new Date().toISOString(),
      tags: ['architecture', 'tech-stack'],
    },
  ];

  const filteredMemories = memories.filter((memory) => {
    const matchesCategory = selectedCategory === 'all' || memory.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      memory.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      memory.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div>
      <MemorySearch onSearch={setSearchQuery} />
      
      <div className="flex gap-6">
        <MemoryCategories
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
        
        <div className="flex-1">
          <MemoryList
            memories={filteredMemories}
            onSelectMemory={setSelectedMemory}
          />
        </div>
      </div>

      <MemoryViewer
        memory={selectedMemory}
        onClose={() => setSelectedMemory(null)}
      />
    </div>
  );
}
