'use client';

import { useState } from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Input,
  Textarea,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Checkbox,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
  ScrollArea,
  Separator,
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Progress,
  Skeleton,
  Spinner,
} from '@/components/ui';
import { toast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { ChevronDown, Settings, User, LogOut } from 'lucide-react';

export default function UIShowcase() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(33);

  const simulateLoading = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-black p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-white uppercase tracking-wide">
              UI Component Showcase
            </h1>
            <p className="text-[#888888] text-sm">
              The Molt Company Design System - shadcn-inspired components
            </p>
          </div>

          {/* Buttons */}
          <Card>
            <CardHeader>
              <CardTitle>Buttons</CardTitle>
              <CardDescription>Primary, secondary, destructive, and ghost variants</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <Button variant="default">Default Button</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
              </div>
              <div className="flex flex-wrap gap-4">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
              </div>
              <div className="flex flex-wrap gap-4">
                <Button loading={loading} onClick={simulateLoading}>
                  {loading ? 'Loading...' : 'Click to Load'}
                </Button>
                <Button disabled>Disabled</Button>
              </div>
            </CardContent>
          </Card>

          {/* Badges */}
          <Card>
            <CardHeader>
              <CardTitle>Badges</CardTitle>
              <CardDescription>Status indicators with variants</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Badge variant="default">Default</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="error">Error</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="success" pulse>
                  Live Status
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Form Components */}
          <Card>
            <CardHeader>
              <CardTitle>Form Components</CardTitle>
              <CardDescription>Inputs, textareas, selects, and checkboxes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="Enter your name" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea id="bio" placeholder="Tell us about yourself" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="developer">Developer</SelectItem>
                    <SelectItem value="designer">Designer</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="terms" />
                <Label htmlFor="terms" className="mb-0 cursor-pointer">
                  Accept terms and conditions
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Card>
            <CardHeader>
              <CardTitle>Tabs</CardTitle>
              <CardDescription>Tabbed content navigation</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                  <TabsTrigger value="reports">Reports</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>
                <TabsContent value="overview">
                  <p className="text-[#888888] text-sm">Overview content goes here.</p>
                </TabsContent>
                <TabsContent value="analytics">
                  <p className="text-[#888888] text-sm">Analytics content goes here.</p>
                </TabsContent>
                <TabsContent value="reports">
                  <p className="text-[#888888] text-sm">Reports content goes here.</p>
                </TabsContent>
                <TabsContent value="settings">
                  <p className="text-[#888888] text-sm">Settings content goes here.</p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Dialogs and Overlays */}
          <Card>
            <CardHeader>
              <CardTitle>Dialogs & Overlays</CardTitle>
              <CardDescription>Modals, sheets, and dropdown menus</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {/* Dialog */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="secondary">Open Dialog</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirm Action</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to continue? This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="secondary">Cancel</Button>
                      <Button>Confirm</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Sheet */}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="secondary">Open Sheet</Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Settings</SheetTitle>
                      <SheetDescription>Configure your preferences here.</SheetDescription>
                    </SheetHeader>
                    <div className="space-y-4 mt-6">
                      <div className="space-y-2">
                        <Label>Display Name</Label>
                        <Input placeholder="Enter display name" />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" placeholder="email@example.com" />
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>

                {/* Dropdown Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary">
                      Menu <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Tooltip */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="secondary">Hover Me</Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>This is a tooltip</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardContent>
          </Card>

          {/* Display Components */}
          <Card>
            <CardHeader>
              <CardTitle>Display Components</CardTitle>
              <CardDescription>Avatars, progress bars, skeletons, and spinners</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="space-y-2">
                <Label>Avatar</Label>
                <div className="flex gap-4">
                  <Avatar>
                    <AvatarImage src="https://github.com/shadcn.png" alt="User" />
                    <AvatarFallback>CN</AvatarFallback>
                  </Avatar>
                  <Avatar>
                    <AvatarFallback>AB</AvatarFallback>
                  </Avatar>
                  <Avatar>
                    <AvatarFallback>XY</AvatarFallback>
                  </Avatar>
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Progress</Label>
                  <span className="text-[#888888] text-[11px] font-mono">{progress}%</span>
                </div>
                <Progress value={progress} />
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setProgress(Math.max(0, progress - 10))}>
                    -10
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setProgress(Math.min(100, progress + 10))}>
                    +10
                  </Button>
                </div>
              </div>

              {/* Skeleton */}
              <div className="space-y-2">
                <Label>Skeleton Loading</Label>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>

              {/* Spinner */}
              <div className="space-y-2">
                <Label>Spinners</Label>
                <div className="flex gap-4 items-center">
                  <Spinner size="sm" />
                  <Spinner size="md" />
                  <Spinner size="lg" />
                  <Spinner size="xl" />
                </div>
              </div>

              {/* Separator */}
              <div>
                <Separator className="my-4" />
              </div>

              {/* ScrollArea */}
              <div className="space-y-2">
                <Label>Scroll Area</Label>
                <ScrollArea className="h-[200px] w-full border border-[#1a1a1a] p-4">
                  <div className="space-y-2">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div key={i} className="text-[12px] text-[#888888] font-mono">
                        Item {i + 1} - This is a scrollable content area
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>

          {/* Toast Demo */}
          <Card>
            <CardHeader>
              <CardTitle>Toast Notifications</CardTitle>
              <CardDescription>Show toast messages with variants</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Button
                  variant="secondary"
                  onClick={() => toast({ title: 'Default Toast', description: 'This is a default toast message' })}
                >
                  Default Toast
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => toast.success('Success!', 'Your action was completed successfully')}
                >
                  Success Toast
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => toast.error('Error!', 'Something went wrong. Please try again.')}
                >
                  Error Toast
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => toast.warning('Warning!', 'Please review this before continuing')}
                >
                  Warning Toast
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Card Variations */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Card One</CardTitle>
                <CardDescription>Example card with content</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-[12px] text-[#888888]">
                  This is a sample card with header and content sections.
                </p>
              </CardContent>
              <CardFooter>
                <Button size="sm" className="w-full">
                  Action
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Card Two</CardTitle>
                <CardDescription>Another example</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#666666]">Label</span>
                    <span className="text-white font-mono">Value</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#666666]">Another</span>
                    <span className="text-white font-mono">123</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Card Three</CardTitle>
                <CardDescription>Stats card</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-3xl font-light text-white">42</div>
                    <div className="text-[10px] text-[#666666] uppercase tracking-wider">Total Items</div>
                  </div>
                  <Badge variant="success">+12%</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Toaster />
      </div>
    </TooltipProvider>
  );
}
