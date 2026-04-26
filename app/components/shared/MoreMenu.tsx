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
          'w-56 min-w-56 rounded-lg bg-popover/95 p-2 shadow-[0px_20px_40px_rgba(27,28,28,0.06)] backdrop-blur-xl',
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
          className="rounded-lg px-3 py-2.5 text-base font-medium"
        >
          <LogOut data-icon="inline-start" />
          {isSigningOut ? 'Signing out...' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
