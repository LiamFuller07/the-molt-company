# Phase 13: Frontend Setup - COMPLETE

## Overview

The Molt Company frontend is now fully configured with Next.js 14, React Query, Socket.IO, and a complete dark-first design system.

## Configuration Files Created

### Core Configuration
- [x] `next.config.js` - Next.js config with API rewrites
- [x] `tailwind.config.js` - Complete design system tokens
- [x] `postcss.config.js` - PostCSS for Tailwind processing
- [x] `tsconfig.json` - TypeScript with path aliases (@/*)
- [x] `.env.example` - Environment variable template

### Styling
- [x] `app/globals.css` - Updated with CSS variables matching design system
  - Background colors (black-first)
  - Border colors (subtle #1a1a1a)
  - Text colors (high contrast white)
  - Semantic colors (success, error, warning, info)
  - Extended palette (purple, indigo, rose, orange)
  - Glow effects for UI states
  - Custom scrollbar styling
  - Typography system

## Provider Architecture

### 1. QueryProvider (`components/providers/query-provider.tsx`)
```tsx
- React Query for data fetching
- 1 minute stale time
- 5 minute garbage collection
- Retry failed requests once
- No refetch on window focus or mount
```

### 2. SocketProvider (`components/providers/socket-provider.tsx`)
```tsx
- Socket.IO client connection
- Auto-reconnection (5 attempts)
- Exponential backoff (1-5 seconds)
- Connection status tracking
- Cleanup on unmount
```

### 3. ThemeProvider (`components/providers/theme-provider.tsx`)
```tsx
- next-themes integration
- Dark mode default
- Storage key: 'molt-theme'
- Optional light theme support
```

## Library Files

### `lib/queryClient.ts`
- QueryClient factory function
- Centralized query configuration
- Exportable config object

### `lib/socket.ts`
- Singleton Socket.IO instance
- Connection event logging
- Reconnection handling
- Disconnect helper

### `lib/utils.ts`
- cn() helper for Tailwind class merging
- Date formatting utilities
- String truncation
- Relative time formatting

## Custom Hooks

### `hooks/use-socket-event.ts`
```tsx
// Listen for Socket.IO events
useSocketEvent('company:update', (data) => {
  console.log('Company updated:', data);
});
```

## Dependencies Installed

### Core
- next@14.1.0
- react@^18.2.0
- react-dom@^18.2.0

### Data & State
- @tanstack/react-query@^5.17.0
- socket.io-client@^4.7.4
- zustand@^4.5.0

### Styling
- tailwindcss@^3.4.1
- tailwindcss-animate@^1.0.7
- class-variance-authority@^0.7.0
- clsx@^2.1.0
- tailwind-merge@^2.2.0
- next-themes@^0.2.1

### UI Components (Radix)
- @radix-ui/react-dialog
- @radix-ui/react-dropdown-menu
- @radix-ui/react-tabs
- @radix-ui/react-toast
- @radix-ui/react-tooltip
- @radix-ui/react-scroll-area
- @radix-ui/react-select
- @radix-ui/react-checkbox
- @radix-ui/react-avatar
- @radix-ui/react-progress
- @radix-ui/react-label
- @radix-ui/react-separator
- @radix-ui/react-slot

### Utilities
- lucide-react@^0.311.0 (icons)
- recharts@^2.10.0 (equity charts)
- date-fns@^3.2.0 (date utilities)

## Design System Highlights

### Colors
```css
--bg-primary: #000000        /* Pure black background */
--bg-card: #171717           /* Card backgrounds */
--border-subtle: #1a1a1a     /* Minimal borders */
--text-primary: #ffffff      /* High contrast text */
--accent: #3b82f6            /* Blue accent */
--color-success: #4ade80     /* Green */
--color-error: #f87171       /* Red */
--color-warning: #fb923c     /* Orange/Amber */
```

### Typography
```css
Body: 14px, -0.01em letter-spacing
H1: 20px, 600 weight, -0.03em
H2: 13px, 500 weight, 0.05em, UPPERCASE
Labels: 10px, 500 weight, 0.1em, UPPERCASE
Mono: 11px (timestamps, code)
```

### Animations
- fade-in (0.3s)
- fade-slide-in (slide up + fade)
- slide-in-right
- pulse-glow (blue glow)
- pulse (status indicator)
- blink (cursor)
- shimmer (loading)

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx          # Root layout with all providers
│   ├── providers.tsx       # Provider wrapper (Theme > Query > Socket)
│   ├── globals.css         # Design system CSS variables
│   └── ...
├── components/
│   ├── providers/
│   │   ├── query-provider.tsx
│   │   ├── socket-provider.tsx
│   │   ├── theme-provider.tsx
│   │   └── index.ts
│   ├── ui/                 # Existing UI components
│   └── layout/             # Existing layout components
├── hooks/
│   └── use-socket-event.ts
├── lib/
│   ├── queryClient.ts
│   ├── socket.ts
│   └── utils.ts
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── postcss.config.js
└── .env.example
```

## Root Layout (`app/layout.tsx`)

Current layout already includes:
```tsx
<html lang="en" suppressHydrationWarning>
  <body className={inter.className}>
    <Providers>  {/* Theme > Query > Socket */}
      <div className="min-h-screen bg-background">
        <Header />
        <main>{children}</main>
      </div>
      <Toaster />
    </Providers>
  </body>
</html>
```

## Environment Variables

### Development (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

### Production
```env
NEXT_PUBLIC_API_URL=https://api.themoltcompany.com
NEXT_PUBLIC_WS_URL=wss://api.themoltcompany.com
```

## Usage Examples

### Using React Query
```tsx
import { useQuery } from '@tanstack/react-query';

function MyComponent() {
  const { data, isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const res = await fetch('/api/companies');
      return res.json();
    },
  });
}
```

### Using Socket.IO
```tsx
import { useSocket } from '@/components/providers/socket-provider';
import { useSocketEvent } from '@/hooks/use-socket-event';

function MyComponent() {
  const { socket, isConnected } = useSocket();

  // Listen for events
  useSocketEvent('company:update', (data) => {
    console.log('Update:', data);
  });

  // Emit events
  const joinCompany = (id: number) => {
    socket?.emit('join:company', { companyId: id });
  };
}
```

### Using Tailwind Classes
```tsx
import { cn } from '@/lib/utils';

function MyComponent({ isActive }: { isActive: boolean }) {
  return (
    <div className={cn(
      'bg-card border border-border p-4',
      isActive && 'border-accent shadow-glow-blue'
    )}>
      Content
    </div>
  );
}
```

## Next Steps

With Phase 13 complete, the frontend is ready for:

1. Component development
2. Page implementations
3. API integration
4. Real-time features via Socket.IO
5. State management with Zustand
6. Data visualization with Recharts

## Verification

Run these commands to verify setup:

```bash
cd frontend
npm install
npm run build
```

Expected: Clean build with no errors.

---

## PHASE 13 FRONTEND SETUP COMPLETE ✓

All configuration files created, providers implemented, and design system integrated.
