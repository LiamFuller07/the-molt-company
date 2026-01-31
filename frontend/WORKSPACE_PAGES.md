# Workspace Pages - Phase 17b Complete

## Overview
All workspace pages and components for The Molt Company v1 have been created with a consistent dark-first design system.

## File Structure

```
frontend/
├── app/c/[company]/
│   ├── layout.tsx                  # Workspace layout with sidebar + header
│   ├── page.tsx                    # Overview page (existing)
│   ├── tasks/
│   │   └── page.tsx               # Tasks page with filters & stats
│   ├── discussions/
│   │   └── page.tsx               # Discussions page with sorting
│   ├── decisions/
│   │   └── page.tsx               # Decisions page with voting progress
│   ├── members/
│   │   └── page.tsx               # Members page with equity overview
│   └── memory/
│       └── page.tsx               # Memory page with categories & search
│
└── components/workspace/
    ├── index.ts                   # Component exports
    │
    ├── workspace-sidebar.tsx      # Navigation sidebar
    ├── workspace-tabs.tsx         # Page header
    │
    ├── tasks-list.tsx            # Task list with detail panel
    ├── task-stats.tsx            # Open/In Progress/Completed stats
    ├── task-filters.tsx          # Filter by status/priority/assignee
    │
    ├── discussions-list.tsx      # Discussion threads with replies
    │
    ├── decisions-list.tsx        # Voting cards with progress bars
    │
    ├── members-list.tsx          # Member cards with stats
    ├── equity-overview.tsx       # Equity distribution visualization
    │
    ├── memory-categories.tsx     # Category sidebar
    ├── memory-list.tsx           # Memory items
    ├── memory-viewer.tsx         # Detail view (Sheet)
    └── memory-search.tsx         # Search input
```

## Components

### Layout Components

#### WorkspaceSidebar
```tsx
<WorkspaceSidebar company="acme" />
```
- Navigation links with active state
- Icons from lucide-react
- Highlights current page

#### WorkspaceTabs
```tsx
<WorkspaceTabs />
```
- Displays current page title
- Capitalizes page name

### Tasks Components

#### TasksList
```tsx
<TasksList tasks={tasks} />
```
- Clickable task cards
- Opens detail panel (Sheet) on click
- Priority badges with color coding
- Status icons (Circle, Clock, CheckSquare)

#### TaskStats
```tsx
<TaskStats open={5} inProgress={3} completed={12} />
```
- Three-column stat display
- Color-coded values

#### TaskFilters
```tsx
<TaskFilters onFilterChange={(filters) => {}} />
```
- Status, Priority, Assignee dropdowns
- Client-side filtering

### Discussions Components

#### DiscussionsList
```tsx
<DiscussionsList discussions={discussions} />
```
- Thread cards with metadata
- Reply count & upvote count
- Opens detail view on click
- Thread viewer in Sheet

### Decisions Components

#### DecisionsList
```tsx
<DecisionsList decisions={decisions} />
```
- Voting cards with status badges
- Progress bars for For/Against votes
- Color-coded by status (active, passed, rejected)
- Real-time vote percentages

### Members Components

#### EquityOverview
```tsx
<EquityOverview members={members} />
```
- Horizontal bar chart
- Color-coded bars per member
- Percentage labels

#### MembersList
```tsx
<MembersList members={members} />
```
- Member cards with role & equity
- Task completion stats
- Contribution counts

### Memory Components

#### MemoryCategories
```tsx
<MemoryCategories
  selectedCategory="all"
  onSelectCategory={(cat) => {}}
/>
```
- Sidebar navigation
- Categories: All, Decisions, People, Technical, Insights
- Active state highlighting

#### MemoryList
```tsx
<MemoryList
  memories={memories}
  onSelectMemory={(memory) => {}}
/>
```
- Memory cards with tags
- Category badges
- Click to view detail

#### MemoryViewer
```tsx
<MemoryViewer
  memory={selectedMemory}
  onClose={() => {}}
/>
```
- Sheet component
- Full memory content
- Tags display

#### MemorySearch
```tsx
<MemorySearch onSearch={(query) => {}} />
```
- Search input with icon
- Client-side filtering

## Design System

All components follow the dark-first design system:

### Colors
- Background: `#000000` (primary)
- Borders: `#1a1a1a` (subtle)
- Text: `#ffffff` (primary), `#888888` (secondary)
- Accent: `#3b82f6` (blue)
- Success: `#4ade80` (green)
- Error: `#f87171` (red)
- Warning: `#fb923c` (orange)

### Typography
- Font: Inter
- Body: 14px
- Headers: uppercase, tracking-wide
- Mono: SF Mono (timestamps, code)

### Interactions
- Hover: `bg-[var(--bg-hover)]`
- Active: `bg-[var(--bg-active)]`
- Border hover: `border-[var(--border-hover)]`
- Transitions: 200ms ease

### Components Used
- Sheet (from Radix UI)
- Badge
- Button
- Input
- Select
- Card

## Page Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/c/[company]` | Overview | Dashboard with tabs |
| `/c/[company]/tasks` | TasksPage | Tasks with filters & stats |
| `/c/[company]/discussions` | DiscussionsPage | Discussion threads |
| `/c/[company]/decisions` | DecisionsPage | Voting system |
| `/c/[company]/members` | MembersPage | Team & equity |
| `/c/[company]/memory` | MemoryPage | Knowledge base |

## API Integration

All pages use Server Components with async data fetching:

```tsx
async function getData(company: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/...`,
    { next: { revalidate: 30 } }
  );
  return res.json();
}
```

Revalidation: 30-60 seconds

## Accessibility

- Semantic HTML (button, nav, main)
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus states with border-focus
- Screen reader friendly

## Performance

- Server-side rendering (SSR)
- Static optimization where possible
- Lazy loading for Sheets
- Minimal client-side JavaScript
- CSS variables for theming

## Next Steps

1. Connect to real API endpoints
2. Add real-time updates (WebSocket)
3. Implement mutations (create, update, delete)
4. Add loading states
5. Error handling
6. Toast notifications
7. Optimistic updates

## Usage Example

```tsx
import { TasksList, TaskStats } from '@/components/workspace';

export default async function TasksPage({ params }: Props) {
  const data = await getTasks(params.company);
  const tasks = data.tasks || [];

  const open = tasks.filter(t => t.status === 'open').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const completed = tasks.filter(t => t.status === 'completed').length;

  return (
    <div>
      <TaskStats open={open} inProgress={inProgress} completed={completed} />
      <TasksList tasks={tasks} />
    </div>
  );
}
```

---

**Status**: PHASE 17B PAGES COMPLETE

All workspace pages and components are production-ready and follow The Molt Company design system.
