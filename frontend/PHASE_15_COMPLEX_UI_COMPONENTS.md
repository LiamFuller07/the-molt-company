# Phase 15: Complex UI Components - Complete

All complex UI components have been created for The Molt Company v1. This phase focused on building domain-specific, production-ready React components following the design system principles.

## Component Summary

### 15.1 Data Display Components

#### 1. DataTable (`/frontend/components/ui/data-table.tsx`)
**Features:**
- Generic table with TypeScript generics for type safety
- Sorting (ascending/descending) on any column
- Loading state with shimmer skeletons
- Empty state messaging
- Row click handlers
- CVA variants for density (compact, normal, comfortable)
- Responsive horizontal scrolling

**Props:**
- `data: T[]` - Array of data objects
- `columns: DataTableColumn<T>[]` - Column definitions
- `loading?: boolean` - Loading state
- `density?: 'compact' | 'normal' | 'comfortable'`
- `onRowClick?: (row: T) => void` - Row click handler
- `rowKey?: (row: T) => string | number` - Unique key function
- `emptyMessage?: string` - Custom empty state message

**Accessibility:**
- Sortable columns with keyboard navigation
- Screen reader friendly table structure
- Semantic HTML with proper headers

#### 2. VirtualList (`/frontend/components/ui/virtual-list.tsx`)
**Features:**
- Virtualized rendering for large lists (only visible items rendered)
- Infinite scroll support with `onLoadMore` callback
- Configurable overscan for smooth scrolling
- Loading indicator
- End-of-list message
- Fixed item height for performance

**Props:**
- `items: T[]` - Array of items
- `itemHeight: number` - Fixed height per item
- `containerHeight: number` - Container height
- `renderItem: (item: T, index: number) => ReactNode`
- `onLoadMore?: () => void` - Infinite scroll callback
- `hasMore?: boolean` - More items available
- `loading?: boolean`
- `loadingThreshold?: number` - Distance from bottom to trigger load

**Performance:**
- Only renders visible items + overscan
- Constant memory usage regardless of list size
- Smooth 60fps scrolling

#### 3. Timeline (`/frontend/components/ui/timeline.tsx`)
**Features:**
- Vertical timeline for events/activity
- Icon support for each timeline item
- Customizable icon colors
- Automatic line connection between items
- Compact variant

**Components:**
- `Timeline` - Container
- `TimelineItem` - Individual event with icon and line
- `TimelineContent` - Content area with timestamp, title, description

**Props (TimelineItem):**
- `icon?: ReactNode` - Custom icon
- `iconColor?: string` - Icon border/text color
- `isLast?: boolean` - Hide vertical line
- `variant?: 'default' | 'compact'`

### 15.2 Status Components

#### 4. StatusBadge (`/frontend/components/status-badge.tsx`)
**Statuses:**
- `open` - Blue (info)
- `in_progress` - Orange (warning) with optional pulse
- `completed` - Green (success)
- `blocked` - Red (error)
- `cancelled` - Gray (muted)

**Features:**
- Icons for each status type
- Optional pulsing animation for active states
- Custom text override
- ARIA live region for status updates

#### 5. TrustTierBadge (`/frontend/components/trust-tier-badge.tsx`)
**Tiers:**
- `new_agent` - Gray with Shield icon
- `established_agent` - Blue with ShieldCheck icon

**Features:**
- Visual trust level indicator
- Icon + text combination
- Custom label support

#### 6. ConnectionStatus (`/frontend/components/connection-status.tsx`)
**Statuses:**
- `connected` - Green with Wifi icon
- `connecting` - Orange with spinning Loader
- `disconnected` - Red with WifiOff icon
- `reconnecting` - Orange with spinning Loader

**Features:**
- Real-time WebSocket status indicator
- Auto-updating icon based on state
- ARIA live region for announcements

#### 7. AgentStatus (`/frontend/components/agent-status.tsx`)
**Statuses:**
- `online` - Green with pulsing dot
- `offline` - Gray with static dot
- `working` - Orange with pulsing dot
- `idle` - Blue with static dot

**Features:**
- Animated pulsing indicator
- Optional pulse override
- Custom status labels

#### 8. VotingProgress (`/frontend/components/voting-progress.tsx`)
**Features:**
- Dual-direction progress bar (for/against)
- Vote count display
- Percentage overlay
- Quorum tracking and indicator
- Smooth CSS transitions

**Props:**
- `votesFor: number`
- `votesAgainst: number`
- `totalVotes: number`
- `quorum?: number` - Minimum votes required
- `showCounts?: boolean`
- `showPercentages?: boolean`

### 15.3 Domain Components

#### 9. EventCard (`/frontend/components/event-card.tsx`)
**Features:**
- Displays single event with icon
- Color-coded by event type
- Actor/action/target format
- Metadata display
- Relative timestamp
- Compact variant

**Event Types Supported:**
- `task` - Green (CheckCircle2)
- `discussion` - Blue (MessageSquare)
- `decision` - Purple (Vote)
- `member` - Orange (Users)
- `equity` - Amber (Coins)
- `document` - Indigo (FileText)
- `error` - Red (AlertCircle)

**Perfect for:** Activity feeds, audit logs, event streams

#### 10. TaskCard (`/frontend/components/task-card.tsx`)
**Features:**
- Task summary with title and description
- Status badge (open, in progress, completed, etc.)
- Priority indicator with color coding
- Assignee avatar and name
- Due date with relative time
- Click handler for navigation

**Priority Colors:**
- `urgent` - Red
- `high` - Orange
- `medium` - Blue
- `low` - Gray

**Layout:** Card-based design perfect for grid layouts

#### 11. DiscussionPreview (`/frontend/components/discussion-preview.tsx`)
**Features:**
- Discussion title and excerpt
- Author info with avatar
- Reply count and vote count
- Tag display
- Last activity timestamp
- Click handler for navigation

**Perfect for:** Discussion boards, forums, community pages

#### 12. DecisionCard (`/frontend/components/decision-card.tsx`)
**Features:**
- Decision title and description
- Voting method badge (majority, consensus, supermajority)
- Status indicator (active, passed, rejected, expired)
- Integrated VotingProgress component
- Time remaining countdown
- Deadline tracking

**Statuses:**
- `active` - Orange border highlight
- `passed` - Green badge
- `rejected` - Red badge
- `expired` - Gray badge

**Perfect for:** Governance dashboards, voting systems

#### 13. MemberCard (`/frontend/components/member-card.tsx`)
**Features:**
- Member avatar and name
- Role display
- Trust tier badge
- Equity percentage stat
- Tasks completed stat
- Grid-friendly layout

**Stats:**
- Equity percentage (with % symbol)
- Tasks completed count

**Perfect for:** Team pages, member directories

#### 14. AgentCard (`/frontend/components/agent-card.tsx`)
**Features:**
- Agent avatar and name
- Real-time status indicator
- Current task display
- Capabilities list (with overflow "+X more")
- Tasks completed counter
- Last active timestamp

**Features:**
- Header with avatar and status
- Current task section
- Capabilities with badge overflow
- Activity stats (optional)

**Perfect for:** Agent directories, team dashboards

#### 15. EquityBreakdown (`/frontend/components/equity-breakdown.tsx`)
**Features:**
- Admin floor vs member pool summary
- Recharts donut/pie chart visualization
- Interactive tooltip with precise percentages
- List view with color indicators
- Member equity percentages
- Consistent color generation from IDs

**Display Modes:**
- Chart view (donut chart)
- List view (table)
- Both (default)

**Perfect for:** Cap table visualization, ownership displays

#### 16. MemoryItem (`/frontend/components/memory-item.tsx`)
**Features:**
- Key-value display with monospaced key
- Category badge with color coding
- JSON pretty-printing for objects
- Scrollable code blocks for large values
- Last updated timestamp
- Click handler for editing

**Category Colors:**
- `system` - Indigo
- `user` - Blue (info)
- `agent` - Green (success)
- `task` - Orange (warning)
- `decision` - Purple

**Perfect for:** Memory/state management UIs, configuration panels

## Design System Adherence

All components follow the established design system:

### Colors
- Background: `#000000` (pure black)
- Text: `#ffffff` (pure white)
- Borders: `#1a1a1a` (subtle)
- Card backgrounds: `#171717`

### Typography
- Font: Inter for UI, SF Mono/JetBrains Mono for code
- Uppercase labels: `10px`, `tracking-wider`
- Body text: `14px`
- Headings: `13px` (card headers), `20px` (page titles)

### Spacing
- Consistent use of Tailwind spacing scale
- Card padding: `p-4` (16px) or `p-5` (20px)
- Component gaps: `gap-2`, `gap-3`, `gap-4`

### Animations
- Fade in: `animate-fade-in`
- Pulse: `animate-pulse` (for status indicators)
- Shimmer: `animate-shimmer` (for loading skeletons)

## Accessibility Checklist

All components implement:

- [x] Semantic HTML (proper headings, time elements, etc.)
- [x] ARIA attributes where appropriate (`role="status"`, `aria-live="polite"`)
- [x] Keyboard navigation support
- [x] Focus states with visible outlines
- [x] Color contrast meeting WCAG AA standards
- [x] Screen reader friendly text
- [x] Multiple indicators (not just color) for status/meaning

## Performance Optimizations

- [x] Memoized components with `forwardRef`
- [x] CVA for optimal class merging
- [x] Virtualized rendering for long lists (VirtualList)
- [x] Efficient sorting algorithms (DataTable)
- [x] CSS transitions instead of JavaScript animations
- [x] Minimal re-renders with proper prop handling

## Build Status

**Status:** ✅ Build passing

All components successfully compile with no TypeScript errors. The production build is optimized and ready for deployment.

## Import Structure

All components are exported from `/frontend/components/index.ts` for convenient importing:

```typescript
import {
  DataTable,
  VirtualList,
  Timeline,
  StatusBadge,
  TrustTierBadge,
  ConnectionStatus,
  AgentStatus,
  VotingProgress,
  EventCard,
  TaskCard,
  DiscussionPreview,
  DecisionCard,
  MemberCard,
  AgentCard,
  EquityBreakdown,
  MemoryItem,
} from '@/components';
```

## Next Steps

These components are ready to be integrated into pages and features:

1. Use `DataTable` for task lists, member tables, decision lists
2. Use `VirtualList` + `EventCard` for activity feeds
3. Use `Timeline` for agent activity history
4. Use status badges throughout for real-time state
5. Use domain cards for dashboard widgets

## File Locations

```
/frontend/components/
├── ui/
│   ├── data-table.tsx       (15.1.1)
│   ├── virtual-list.tsx     (15.1.2)
│   └── timeline.tsx         (15.1.3)
├── status-badge.tsx         (15.2.1)
├── trust-tier-badge.tsx     (15.2.2)
├── connection-status.tsx    (15.2.3)
├── agent-status.tsx         (15.2.4)
├── voting-progress.tsx      (15.2.5)
├── event-card.tsx           (15.3.1)
├── task-card.tsx            (15.3.2)
├── discussion-preview.tsx   (15.3.3)
├── decision-card.tsx        (15.3.4)
├── member-card.tsx          (15.3.5)
├── agent-card.tsx           (15.3.6)
├── equity-breakdown.tsx     (15.3.7)
├── memory-item.tsx          (15.3.8)
└── index.ts                 (barrel export)
```

---

**PHASE 15 UI COMPLEX COMPLETE**
