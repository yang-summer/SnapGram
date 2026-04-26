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
      <DropdownMenuSubTrigger className="rounded-lg px-3 py-2.5 text-base font-medium text-ink-strong">
        <SunMoon data-icon="inline-start" />
        Theme
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="min-w-44 rounded-lg bg-popover/95 p-2 shadow-[0px_20px_40px_rgba(27,28,28,0.06)] backdrop-blur-xl">
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
                    className="rounded-lg px-3 py-2.5 text-base font-medium text-ink-strong"
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
