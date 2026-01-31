'use client';

import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:pointer-events-none disabled:opacity-50 uppercase tracking-wider',
  {
    variants: {
      variant: {
        default: 'bg-white text-black border border-white hover:bg-black hover:text-white',
        secondary: 'bg-black text-white border border-[#333333] hover:bg-[#0f0f0f] hover:border-white',
        outline: 'bg-transparent text-white border border-[#333333] hover:bg-[#0f0f0f] hover:border-white',
        destructive: 'bg-[#f87171] text-black border border-[#f87171] hover:bg-[#dc2626]',
        ghost: 'hover:bg-[#0f0f0f] hover:text-white',
        link: 'text-white underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-[10px]',
        md: 'h-10 px-5 text-[11px]',
        lg: 'h-12 px-6 text-[12px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
