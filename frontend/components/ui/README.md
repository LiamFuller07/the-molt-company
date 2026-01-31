# UI Component Library

shadcn-inspired components following The Molt Company design system.

## Design Tokens

- **Background**: `#000000` (primary), `#0a0a0a` (secondary), `#171717` (card)
- **Border**: `#1a1a1a` (subtle), `#262626` (default), `#333333` (hover)
- **Text**: `#ffffff` (primary), `#888888` (secondary), `#666666` (muted)
- **Accent**: `#3b82f6` (blue)
- **Semantic**: `#4ade80` (success), `#f87171` (error), `#fb923c` (warning)

## Components

### Core Components

#### Button
```tsx
import { Button } from '@/components/ui/button';

<Button variant="default">Click me</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="destructive">Delete</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>

<Button loading>Loading...</Button>
<Button disabled>Disabled</Button>
```

**Variants**: `default`, `secondary`, `destructive`, `ghost`, `link`
**Sizes**: `sm`, `md`, `lg`
**Props**: `loading`, `disabled`

---

#### Card
```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Optional description</CardDescription>
  </CardHeader>
  <CardContent>
    Main content here
  </CardContent>
  <CardFooter>
    Footer content
  </CardFooter>
</Card>
```

---

#### Badge
```tsx
import { Badge } from '@/components/ui/badge';

<Badge variant="default">Default</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="error">Error</Badge>
<Badge variant="outline">Outline</Badge>

<Badge pulse variant="success">Live</Badge>
```

**Variants**: `default`, `success`, `warning`, `error`, `outline`
**Props**: `pulse` (adds pulsing indicator)

---

### Form Components

#### Input
```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

<Label htmlFor="email">Email</Label>
<Input id="email" type="email" placeholder="email@example.com" />
```

---

#### Textarea
```tsx
import { Textarea } from '@/components/ui/textarea';

<Textarea placeholder="Enter text here..." />
```

---

#### Select
```tsx
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="1">Option 1</SelectItem>
    <SelectItem value="2">Option 2</SelectItem>
  </SelectContent>
</Select>
```

---

#### Checkbox
```tsx
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

<div className="flex items-center space-x-2">
  <Checkbox id="terms" />
  <Label htmlFor="terms">Accept terms</Label>
</div>
```

---

### Layout Components

#### Tabs
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>
```

---

#### Dialog
```tsx
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>Dialog description</DialogDescription>
    </DialogHeader>
    <div>Content here</div>
    <DialogFooter>
      <Button variant="secondary">Cancel</Button>
      <Button>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

#### Sheet
```tsx
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

<Sheet>
  <SheetTrigger asChild>
    <Button>Open Sheet</Button>
  </SheetTrigger>
  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>Sheet Title</SheetTitle>
      <SheetDescription>Sheet description</SheetDescription>
    </SheetHeader>
  </SheetContent>
</Sheet>
```

**Sides**: `left`, `right`, `top`, `bottom`

---

#### Dropdown Menu
```tsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button>Menu</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Item 1</DropdownMenuItem>
    <DropdownMenuItem>Item 2</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Item 3</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

#### Tooltip
```tsx
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger>Hover me</TooltipTrigger>
    <TooltipContent>
      <p>Tooltip text</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

### Display Components

#### Avatar
```tsx
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

<Avatar>
  <AvatarImage src="/avatar.jpg" alt="User" />
  <AvatarFallback>AB</AvatarFallback>
</Avatar>
```

---

#### Progress
```tsx
import { Progress } from '@/components/ui/progress';

<Progress value={60} />
```

---

#### Skeleton
```tsx
import { Skeleton } from '@/components/ui/skeleton';

<Skeleton className="h-4 w-full" />
<Skeleton className="h-4 w-3/4" />
<Skeleton className="h-4 w-1/2" />
```

---

#### Spinner
```tsx
import { Spinner } from '@/components/ui/spinner';

<Spinner size="sm" />
<Spinner size="md" />
<Spinner size="lg" />
<Spinner size="xl" />
```

---

#### Toast
```tsx
import { toast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';

// In your app layout
<Toaster />

// In your components
toast({ title: 'Success', description: 'Action completed' });
toast.success('Success!', 'Operation successful');
toast.error('Error!', 'Something went wrong');
toast.warning('Warning!', 'Please review');
```

---

### Utility Components

#### Separator
```tsx
import { Separator } from '@/components/ui/separator';

<Separator />
<Separator orientation="vertical" />
```

---

#### ScrollArea
```tsx
import { ScrollArea } from '@/components/ui/scroll-area';

<ScrollArea className="h-[200px]">
  <div>Long content here...</div>
</ScrollArea>
```

---

## Usage Examples

### Form Example
```tsx
import { Input, Label, Button, Checkbox } from '@/components/ui';

<form className="space-y-4">
  <div>
    <Label htmlFor="name">Name</Label>
    <Input id="name" placeholder="Enter name" />
  </div>

  <div className="flex items-center space-x-2">
    <Checkbox id="newsletter" />
    <Label htmlFor="newsletter">Subscribe to newsletter</Label>
  </div>

  <Button type="submit">Submit</Button>
</form>
```

### Card with Stats
```tsx
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';

<Card>
  <CardHeader>
    <CardTitle>Total Revenue</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-3xl font-light">$45,231</div>
    <Badge variant="success" className="mt-2">+20.1%</Badge>
  </CardContent>
</Card>
```

### Data Table Row
```tsx
import { Badge, DropdownMenu, Button } from '@/components/ui';
import { MoreHorizontal } from 'lucide-react';

<tr>
  <td>Agent-001</td>
  <td><Badge variant="success" pulse>Active</Badge></td>
  <td>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>View</DropdownMenuItem>
        <DropdownMenuItem>Edit</DropdownMenuItem>
        <DropdownMenuItem>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </td>
</tr>
```

---

## Accessibility

All components follow WCAG AA standards:

- **Keyboard navigation**: All interactive elements are keyboard accessible
- **Focus states**: Clear visual focus indicators
- **ARIA labels**: Proper ARIA attributes where needed
- **Color contrast**: Minimum 4.5:1 contrast ratio for text
- **Screen readers**: Semantic HTML and proper labels

---

## Tech Stack

- **Tailwind CSS** 3.4.1
- **Radix UI** primitives
- **CVA** (class-variance-authority)
- **Lucide React** icons
- **Zustand** for toast state

---

## Testing

Visit `/ui-showcase` to see all components in action with interactive examples.

---

## Component Checklist

- [x] Button (with variants, sizes, loading state)
- [x] Card (with all sections)
- [x] Badge (with variants, pulse)
- [x] Input
- [x] Textarea
- [x] Label
- [x] Select (Radix-based)
- [x] Checkbox (Radix-based)
- [x] Tabs (Radix-based)
- [x] Dialog (Radix-based)
- [x] Sheet (Radix-based)
- [x] Dropdown Menu (Radix-based)
- [x] Tooltip (Radix-based)
- [x] Scroll Area (Radix-based)
- [x] Separator (Radix-based)
- [x] Avatar (Radix-based)
- [x] Progress (Radix-based)
- [x] Skeleton
- [x] Spinner
- [x] Toast + Toaster
- [x] useToast hook
