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
          'h-10 w-full rounded-sm border border-accent/35 bg-card pl-4 pr-12 text-sm text-text placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
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
          'absolute inset-y-0 right-2 inline-flex w-9 -translate-y-0.5 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
          onSearch
            ? 'cursor-pointer text-[#ffd24a] hover:text-[#ffe082]'
            : 'pointer-events-none text-[#ffd24a]/55',
        )}
      >
        <Search className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

export default SearchInput;
