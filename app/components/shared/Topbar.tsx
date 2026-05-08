import { useEffect, useState, type SubmitEvent } from 'react';
import { Link, useLocation, useNavigate, type Location } from 'react-router';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '../ui/input-group';
import { Menu, SearchIcon } from 'lucide-react';
import { toast } from 'sonner';
import MoreMenu from '~/components/shared/MoreMenu';

const SEARCH_RESULT_ROUTE = '/search-result';
const SEARCH_KEYWORD_MIN_LENGTH = 3;

type TopbarProps = {
  location?: Pick<Location, 'pathname' | 'search'>;
};

export default function Topbar({ location: providedLocation }: TopbarProps) {
  const navigate = useNavigate();
  const currentLocation = useLocation();
  const location = providedLocation ?? currentLocation;
  const isSearchResultRoute = location.pathname === SEARCH_RESULT_ROUTE;
  const routeKeyword = isSearchResultRoute
    ? (new URLSearchParams(location.search).get('keyword') ?? '').trim()
    : null;
  const [searchValue, setSearchValue] = useState(routeKeyword ?? '');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  useEffect(() => {
    if (!isSearchResultRoute) {
      setSearchValue('');
      return;
    }

    setSearchValue(routeKeyword ?? '');
  }, [isSearchResultRoute, routeKeyword]);

  function handleSearchSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedKeyword = searchValue.trim();

    if (normalizedKeyword.length === 0) {
      toast.error('Enter a keyword to search posts.');
      return;
    }

    if (normalizedKeyword.length < SEARCH_KEYWORD_MIN_LENGTH) {
      toast.error('Enter at least 3 characters to search posts.');
      return;
    }

    const nextSearchParams = new URLSearchParams({
      keyword: normalizedKeyword,
    });

    void navigate(`${SEARCH_RESULT_ROUTE}?${nextSearchParams.toString()}`);
  }

  function renderLogo() {
    return (
      <Link to="/" className="min-w-0 justify-self-start">
        <div className="flex items-center gap-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-700">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path>
              <path d="M20 2v4"></path>
              <path d="M22 4h-4"></path>
              <circle cx="4" cy="20" r="2"></circle>
            </svg>
          </div>
          <span className="text-2xl font-black text-blue-700">Snapgram</span>
        </div>
      </Link>
    );
  }

  function renderMoreMenu() {
    return (
      <MoreMenu
        side="bottom"
        align="end"
        trigger={
          <button
            type="button"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-surface-soft"
            aria-label="More"
          >
            <Menu className="h-6 w-6" />
          </button>
        }
      />
    );
  }

  function renderSearchForm({
    className,
    autoFocus = false,
  }: {
    className: string;
    autoFocus?: boolean;
  }) {
    return (
      <form onSubmit={handleSearchSubmit} className={className} autoComplete="off">
        <InputGroup className="h-12 w-full rounded-full bg-surface-soft border-0 shadow-none has-[[data-slot=input-group-control]:focus-visible]:border-transparent has-[[data-slot=input-group-control]:focus-visible]:ring-0 has-[[data-slot=input-group-control]:focus-visible]:shadow-none">
          <InputGroupInput
            name="keyword"
            value={searchValue}
            autoFocus={autoFocus}
            autoComplete="off"
            onChange={(event) => {
              setSearchValue(event.target.value);
            }}
            className="text-base placeholder:text-base placeholder:text-ink-placeholder focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none"
            placeholder="Search..."
            aria-label="Search posts"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="submit"
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer rounded-full text-ink-subtle hover:bg-transparent"
              aria-label="Search posts"
              title="Search posts"
            >
              <SearchIcon className="h-5 w-5" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
    );
  }

  return (
    <div className="h-full bg-surface-raised">
      <div className="flex h-full items-center sm:hidden">
        {isMobileSearchOpen ? (
          <>
            {renderSearchForm({
              className: 'min-w-0 flex-1',
              autoFocus: true,
            })}
            <button
              type="button"
              onClick={() => {
                setIsMobileSearchOpen(false);
              }}
              className="ml-2 shrink-0 rounded-full px-3 py-2 text-base font-medium text-ink-subtle transition-colors hover:bg-surface-soft"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {renderLogo()}
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setIsMobileSearchOpen(true);
                }}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-surface-soft"
                aria-label="Search posts"
                title="Search posts"
              >
                <SearchIcon className="h-5 w-5" />
              </button>
              {renderMoreMenu()}
            </div>
          </>
        )}
      </div>
      <div className="hidden h-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 sm:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        {renderLogo()}
        {renderSearchForm({
          className:
            'w-full min-w-0 justify-self-center sm:max-w-[34rem] lg:w-[min(35vw,600px)] lg:max-w-none',
        })}
        <div className="justify-self-end">
          <div className="lg:hidden">{renderMoreMenu()}</div>
        </div>
      </div>
    </div>
  );
}
