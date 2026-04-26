import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import ThemeSubmenu from '~/components/shared/ThemeSubmenu';
import { useSignOutMutation } from '~/features/auth/queries/auth.mutations';
import { cn } from '~/lib/utils';

type MoreMenuProps = {
  trigger: ReactElement;
  contentClassName?: string;
  side?: ComponentProps<typeof DropdownMenuContent>['side'];
  align?: ComponentProps<typeof DropdownMenuContent>['align'];
  sideOffset?: ComponentProps<typeof DropdownMenuContent>['sideOffset'];
  alignOffset?: ComponentProps<typeof DropdownMenuContent>['alignOffset'];
};

export default function MoreMenu({
  trigger,
  contentClassName,
  side = 'bottom',
  align = 'end',
  sideOffset = 4,
  alignOffset = 0,
}: MoreMenuProps) {
  const { mutate: signOut, isPending: isSigningOut } = useSignOutMutation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        className={cn(
          'w-56 min-w-56 rounded-lg bg-popover/95 p-2 ring-0 shadow-[0_2px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:shadow-[0_0_0_1px_var(--border),0_2px_24px_rgba(0,0,0,0.08)]',
          contentClassName,
        )}
      >
        <ThemeSubmenu />
        <DropdownMenuSeparator className="mx-2 bg-border/60" />
        <DropdownMenuItem
          variant="destructive"
          disabled={isSigningOut}
          onSelect={() => {
            signOut();
          }}
          className="cursor-pointer rounded-lg px-3 py-2.5 text-base font-medium"
        >
          <LogOut data-icon="inline-start" />
          {isSigningOut ? 'Signing out...' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
