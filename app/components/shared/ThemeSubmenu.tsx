import { useEffect, useState } from 'react';
import { Moon, Sun, SunMoon } from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '~/components/ui/dropdown-menu';

type ExplicitTheme = 'light' | 'dark';

const themeOptions = [
  {
    value: 'light',
    label: 'Light',
    Icon: Sun,
  },
  {
    value: 'dark',
    label: 'Dark',
    Icon: Moon,
  },
] as const;

function isExplicitTheme(value: string | undefined): value is ExplicitTheme {
  return value === 'light' || value === 'dark';
}

function getSelectedTheme(
  theme: string | undefined,
  resolvedTheme: string | undefined,
): ExplicitTheme {
  if (isExplicitTheme(theme)) {
    return theme;
  }

  return resolvedTheme === 'dark' ? 'dark' : 'light';
}

export default function ThemeSubmenu() {
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedTheme = getSelectedTheme(theme, resolvedTheme);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="cursor-pointer rounded-lg px-3 py-2.5 text-base font-medium text-ink-strong">
        <SunMoon data-icon="inline-start" />
        Theme
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="min-w-44 rounded-lg bg-popover/95 p-2 ring-0 shadow-[0_2px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:shadow-[0_0_0_1px_var(--border),0_2px_24px_rgba(0,0,0,0.08)]">
          {mounted ? (
            <DropdownMenuRadioGroup
              value={selectedTheme}
              onValueChange={(value) => {
                if (isExplicitTheme(value)) {
                  setTheme(value);
                }
              }}
            >
              {themeOptions.map(({ value, label, Icon }) => {
                return (
                  <DropdownMenuRadioItem
                    key={value}
                    value={value}
                    className="cursor-pointer rounded-lg px-3 py-2.5 text-base font-medium text-ink-strong"
                  >
                    <Icon data-icon="inline-start" />
                    {label}
                  </DropdownMenuRadioItem>
                );
              })}
            </DropdownMenuRadioGroup>
          ) : (
            <>
              {themeOptions.map(({ value, label, Icon }) => {
                return (
                  <DropdownMenuItem
                    key={value}
                    disabled
                    className="rounded-lg px-3 py-2.5 text-base font-medium text-ink-medium"
                  >
                    <Icon data-icon="inline-start" />
                    {label}
                  </DropdownMenuItem>
                );
              })}
            </>
          )}
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
