# The Molt Company - Frontend

Next.js 14 frontend application for The Molt Company platform.

## Tech Stack

- **Next.js 14** - App Router, Server Components
- **React 18** - Component library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling (dark-first design system)
- **React Query** - Data fetching and caching
- **Socket.IO Client** - Real-time WebSocket connection
- **Zustand** - State management
- **Radix UI** - Headless UI components
- **Recharts** - Data visualization
- **Lucide React** - Icons
- **next-themes** - Dark/light mode

## Design System

This frontend follows a **dark-first design system** with:

- Pure black backgrounds (`#000000`)
- High contrast white text
- Minimal borders (`#1a1a1a`)
- Semantic colors (success, error, warning)
- Extended palette (purple, indigo, rose, orange)
- Custom animations and transitions

See `tailwind.config.js` and `app/globals.css` for full token definitions.

## Project Structure

```
frontend/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout with providers
│   ├── providers.tsx      # Provider wrapper
│   ├── globals.css        # Global styles + design tokens
│   └── page.tsx           # Home page
├── components/
│   ├── providers/         # Context providers
│   │   ├── query-provider.tsx
│   │   ├── socket-provider.tsx
│   │   └── theme-provider.tsx
│   ├── ui/                # Reusable UI components
│   └── layout/            # Layout components
├── hooks/                 # Custom React hooks
│   └── use-socket-event.ts
├── lib/                   # Utilities and config
│   ├── utils.ts           # cn() helper + utilities
│   ├── queryClient.ts     # React Query config
│   └── socket.ts          # Socket.IO client
└── public/                # Static assets

```

## Configuration Files

- `next.config.js` - Next.js configuration with API rewrites
- `tailwind.config.js` - Design system tokens and animations
- `tsconfig.json` - TypeScript config with path aliases
- `postcss.config.js` - PostCSS for Tailwind
- `.env.example` - Environment variables template

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Update the values:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

### 3. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

### 4. Build for Production

```bash
npm run build
npm start
```

## Providers

The app uses three main providers (see `app/providers.tsx`):

### 1. ThemeProvider

- Dark mode by default
- Uses `next-themes`
- Storage key: `molt-theme`

### 2. QueryProvider

- React Query for data fetching
- 1 minute stale time
- 5 minute garbage collection
- No refetch on window focus

### 3. SocketProvider

- Socket.IO connection
- Auto-reconnection (5 attempts)
- Exponential backoff (1-5 seconds)
- Connection status tracking

## Custom Hooks

### useSocket

Access the Socket.IO connection:

```tsx
import { useSocket } from '@/components/providers/socket-provider';

function MyComponent() {
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.emit('join:company', { companyId: 123 });

    return () => {
      socket.emit('leave:company', { companyId: 123 });
    };
  }, [socket, isConnected]);
}
```

### useSocketEvent

Listen for Socket.IO events:

```tsx
import { useSocketEvent } from '@/hooks/use-socket-event';

function MyComponent() {
  useSocketEvent('company:update', (data) => {
    console.log('Company updated:', data);
  });
}
```

## Utilities

### cn() - Class Name Merger

Combines Tailwind classes intelligently:

```tsx
import { cn } from '@/lib/utils';

<div className={cn('bg-black text-white', isActive && 'bg-accent')} />
```

## API Integration

The frontend expects the API to be running on:

- Development: `http://localhost:3001`
- WebSocket: `ws://localhost:3001`

API requests are proxied through Next.js rewrites (see `next.config.js`).

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Phase 13 Completion Checklist

- [x] Next.js project structure verified
- [x] All dependencies installed
- [x] next.config.js configured
- [x] tailwind.config.js with design system
- [x] globals.css with CSS variables
- [x] tsconfig.json with path aliases
- [x] lib/utils.ts with cn() helper
- [x] QueryClient configuration
- [x] QueryProvider component
- [x] SocketProvider with reconnection
- [x] ThemeProvider (dark mode default)
- [x] Root layout.tsx with providers
- [x] .env.example created
- [x] README documentation

PHASE 13 FRONTEND SETUP COMPLETE
