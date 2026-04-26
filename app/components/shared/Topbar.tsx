import { useEffect, useState, type SubmitEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '../ui/input-group';
import { LogOut, Menu, SearchIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ThemeToggle } from './ThemeToggle';
import { useSignOutMutation } from '~/features/auth/queries/auth.mutations';

const SEARCH_RESULT_ROUTE = '/search-result';
const SEARCH_KEYWORD_MIN_LENGTH = 3;

export default function Topbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { mutate: signOut, isPending: isSigningOut } = useSignOutMutation();
  const isSearchResultRoute = location.pathname === SEARCH_RESULT_ROUTE;
  const routeKeyword = isSearchResultRoute ? (searchParams.get('keyword') ?? '').trim() : null;
  const [searchValue, setSearchValue] = useState(routeKeyword ?? '');

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

  return (
    <div className="flex items-center justify-between h-full bg-surface-raised">
      <Link to="/">
        <div className="flex gap-1 items-center">
          <div className="bg-blue-600 w-12 h-12 rounded-full flex justify-center items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path>
              <path d="M20 2v4"></path>
              <path d="M22 4h-4"></path>
              <circle cx="4" cy="20" r="2"></circle>
            </svg>
          </div>
          <span className="text-[1.75rem] font-black text-blue-700">小蓝书</span>
        </div>
      </Link>
      <form onSubmit={handleSearchSubmit} className="w-[min(35vw,600px)]">
        <InputGroup className="h-12 w-full rounded-full bg-surface-soft border-0 shadow-none has-[[data-slot=input-group-control]:focus-visible]:border-transparent has-[[data-slot=input-group-control]:focus-visible]:ring-0 has-[[data-slot=input-group-control]:focus-visible]:shadow-none">
          <InputGroupInput
            name="keyword"
            value={searchValue}
            onChange={(event) => {
              setSearchValue(event.target.value);
            }}
            className="placeholder:text-ink-placeholder focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none"
            placeholder="Search..."
            aria-label="Search posts"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="submit"
              variant="ghost"
              size="icon-sm"
              className="rounded-full text-ink-subtle hover:bg-transparent"
              aria-label="Search posts"
              title="Search posts"
            >
              <SearchIcon className="h-5 w-5" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <button
          type="button"
          onClick={() => signOut()}
          disabled={isSigningOut}
          aria-label="登出"
          title="登出"
          className="flex items-center justify-center h-10 w-10 text-ink-subtle rounded-full hover:bg-surface-soft cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LogOut className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="lg:hidden flex items-center justify-center h-10 w-10 text-ink-subtle rounded-full hover:bg-surface-soft cursor-pointer"
          aria-label="更多"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
