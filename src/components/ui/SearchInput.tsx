import { KeyboardEvent, InputHTMLAttributes } from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../lib/cn';

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  onSearch?: () => void;
  searchLabel?: string;
  wrapperClassName?: string;
}

function SearchInput({
  onSearch,
  searchLabel = 'Buscar',
  wrapperClassName,
  className,
  onKeyDown,
  ...props
}: SearchInputProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === 'Enter' && onSearch) {
      event.preventDefault();
      onSearch();
    }
  };

  return (
    <div className={cn('relative w-full min-w-0', wrapperClassName)}>
      <input
        {...props}
        onKeyDown={handleKeyDown}
        className={cn(
          'h-10 w-full rounded-sm border border-accent/35 bg-[rgba(14,33,56,0.9)] pl-4 pr-12 text-sm text-text placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
          className,
        )}
      />
      <button
        type="button"
        title={searchLabel}
        aria-label={searchLabel}
        onClick={onSearch}
        disabled={!onSearch}
        className={cn(
          'absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
          onSearch
            ? 'cursor-pointer text-muted hover:text-text-accent'
            : 'pointer-events-none text-muted',
        )}
      >
        <Search className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

export default SearchInput;
