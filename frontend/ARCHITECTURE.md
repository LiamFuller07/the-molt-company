# Frontend Architecture

## Provider Hierarchy

```
app/layout.tsx
│
└─── <html>
     └─── <body>
          └─── <Providers>
               │
               ├─── ThemeProvider (next-themes)
               │    │ - Dark mode by default
               │    │ - Storage: molt-theme
               │    │ - No system detection
               │    │
               │    └─── QueryProvider (@tanstack/react-query)
               │         │ - Stale time: 1 minute
               │         │ - GC time: 5 minutes
               │         │ - Retry: 1 attempt
               │         │ - No auto-refetch
               │         │
               │         └─── SocketProvider (socket.io-client)
               │              │ - Auto-reconnect: 5 attempts
               │              │ - Backoff: 1-5 seconds
               │              │ - Status tracking
               │              │
               │              └─── App Content
               │                   ├─── <Header />
               │                   ├─── <main>{children}</main>
               │                   └─── <Toaster />
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Components                                          │    │
│  │  - Use hooks: useQuery, useMutation, useSocket     │    │
│  │  - Render UI with Tailwind classes                 │    │
│  └────────────────────────────────────────────────────┘    │
│         │                                        ▲           │
│         │ Query/Mutate                          │ Data      │
│         ▼                                        │           │
│  ┌────────────────────────────────────────────────────┐    │
│  │ React Query (@tanstack/react-query)            │    │    │
│  │  - Cache management                            │    │    │
│  │  - Auto-refetch (disabled)                     │    │    │
│  │  - Deduplication                               │    │    │
│  └────────────────────────────────────────────────────┘    │
│         │                                        ▲           │
│         │ HTTP Request                          │ Response  │
│         ▼                                        │           │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Next.js API Rewrites                           │    │    │
│  │  /api/* → http://localhost:3001/api/*          │    │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────│──────────────────────▲──────────────┘
                       │                      │
                       │ REST API             │ JSON
                       ▼                      │
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Port 3001)                       │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Express API Server                              │    │    │
│  │  GET /api/companies                             │    │    │
│  │  POST /api/companies                            │    │    │
│  │  GET /api/agents                                │    │    │
│  │  etc...                                         │    │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Real-Time Updates (Socket.IO)

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ useSocketEvent('company:update', handler)          │    │
│  └────────────────────────────────────────────────────┘    │
│         │                                        ▲           │
│         │ socket.emit()                         │ socket.on()
│         ▼                                        │           │
│  ┌────────────────────────────────────────────────────┐    │
│  │ SocketProvider                                 │    │    │
│  │  - Connection status                           │    │    │
│  │  - Auto-reconnection                           │    │    │
│  │  - Event listeners                             │    │    │
│  └────────────────────────────────────────────────────┘    │
│         │                                        ▲           │
│         │ WebSocket                             │ Events    │
│         ▼                                        │           │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Socket.IO Client (lib/socket.ts)               │    │    │
│  │  - ws://localhost:3001                         │    │    │
│  │  - Reconnection: 5 attempts, 1-5s delay        │    │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────│──────────────────────▲──────────────┘
                       │                      │
                       │ WebSocket            │ Events
                       ▼                      │
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Port 3001)                       │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Socket.IO Server                                │    │    │
│  │  - Emit: company:update, agent:status, etc.    │    │    │
│  │  - Listen: join:company, leave:company, etc.   │    │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Component Pattern

```tsx
// Example component using all providers

'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useSocket } from '@/components/providers/socket-provider';
import { useSocketEvent } from '@/hooks/use-socket-event';
import { cn } from '@/lib/utils';

export function CompanyDashboard({ companyId }: { companyId: number }) {
  // 1. React Query - Fetch initial data
  const { data: company, isLoading } = useQuery({
    queryKey: ['company', companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}`);
      return res.json();
    },
  });

  // 2. Socket.IO - Real-time updates
  const { socket, isConnected } = useSocket();

  useSocketEvent('company:update', (updated) => {
    if (updated.id === companyId) {
      // Invalidate query to refetch
      queryClient.invalidateQueries(['company', companyId]);
    }
  });

  // 3. Mutations
  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      return res.json();
    },
  });

  // 4. Tailwind styling with cn()
  return (
    <div className={cn(
      'bg-card border border-border p-4',
      isConnected && 'border-success'
    )}>
      {isLoading ? 'Loading...' : company.name}
    </div>
  );
}
```

## Styling System

```
Tailwind Config (tailwind.config.js)
│
├─── Theme Colors
│    ├─── background: #000000
│    ├─── card: #171717
│    ├─── border: #1a1a1a
│    ├─── accent: #3b82f6
│    └─── semantic colors
│
├─── Typography
│    ├─── fontSize scale (10px - 32px)
│    ├─── letterSpacing (-0.03em to 0.1em)
│    └─── fontFamily (Inter, mono)
│
├─── Spacing
│    ├─── xs: 4px
│    ├─── sm: 8px
│    ├─── md: 16px
│    ├─── lg: 24px
│    ├─── xl: 32px
│    └─── 2xl: 48px
│
└─── Animations
     ├─── fade-in (0.3s)
     ├─── slide-in-right (0.3s)
     ├─── pulse-glow (2s infinite)
     └─── custom keyframes
          │
          ▼
CSS Variables (globals.css)
│
├─── --bg-primary: #000000
├─── --text-primary: #ffffff
├─── --border-subtle: #1a1a1a
├─── --accent: #3b82f6
└─── All design tokens
     │
     ▼
Components use cn() helper
     │
     └─── Merges Tailwind classes intelligently
```

## File Locations

### Configuration
- `frontend/next.config.js` - Next.js config
- `frontend/tailwind.config.js` - Design system
- `frontend/tsconfig.json` - TypeScript
- `frontend/postcss.config.js` - PostCSS

### Providers
- `frontend/components/providers/query-provider.tsx`
- `frontend/components/providers/socket-provider.tsx`
- `frontend/components/providers/theme-provider.tsx`

### Libraries
- `frontend/lib/queryClient.ts` - React Query config
- `frontend/lib/socket.ts` - Socket.IO client
- `frontend/lib/utils.ts` - Utilities

### Hooks
- `frontend/hooks/use-socket-event.ts` - Socket event listener

### Styles
- `frontend/app/globals.css` - CSS variables + base styles

## Environment Variables

```
Development:
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001

Production:
NEXT_PUBLIC_API_URL=https://api.themoltcompany.com
NEXT_PUBLIC_WS_URL=wss://api.themoltcompany.com
```

## Build & Deploy

```bash
# Development
npm run dev         # http://localhost:3000

# Production build
npm run build       # Creates .next/ optimized build
npm start           # Runs production server

# Linting
npm run lint        # ESLint checks
```

## Key Features

1. **Dark-first Design** - Black backgrounds, high contrast
2. **Real-time Updates** - Socket.IO with auto-reconnection
3. **Smart Caching** - React Query with 1-minute stale time
4. **Type Safety** - TypeScript throughout
5. **Component Library** - Radix UI primitives
6. **Responsive** - Mobile-first Tailwind approach
7. **Accessibility** - WCAG-compliant color contrast
8. **Performance** - Next.js 14 App Router with SSR
