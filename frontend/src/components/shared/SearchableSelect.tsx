/**
 * @fileoverview A searchable dropdown component that provides an interactive UI for selecting
 * options from a list. It supports both local filtering and remote (async) searching.
 */
import { useState, useMemo, useEffect } from "react";
import { ChevronDown, Search, Loader2 } from "lucide-react";
import { capitalize, cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Represents an individual selectable item in the search list.
 */
interface Option {
  /** Unique identifier for the option. */
  id: string;
  /** Human-readable text displayed for the option. */
  label: string;
}

/**
 * Props for the {@link SearchableSelect} component.
 */
interface SearchableSelectProps {
  /** The currently selected value (id). */
  value: string;
  /** Callback fired when a new option is selected. */
  onValueChange: (value: string) => void;
  /** List of available options to display. */
  options: Option[];
  /** Text to show when no option is selected. @defaultValue "Select option..." */
  placeholder?: string;
  /** Placeholder text for the internal search input. @defaultValue "Search..." */
  searchPlaceholder?: string;
  /** Whether the entire component is disabled. @defaultValue false */
  disabled?: boolean;
  /** Whether the component is in a generic loading state (replaces content). @defaultValue false */
  loading?: boolean;
  /** Text shown when the component is in the generic loading state. @defaultValue "Loading..." */
  loadingPlaceholder?: string;
  /** Message shown when no options match the search criteria. @defaultValue "No options found" */
  emptyMessage?: string;
  /** Text used in the "X more options..." footer when the display limit is exceeded. @defaultValue "options" */
  moreText?: string;
  /**
   * Optional callback triggered on every search input change.
   * Useful for backend-driven searches. The consumer is responsible for debouncing.
   */
  onSearch?: (query: string) => void;
  /**
   * When true, shows an inline spinner in the search input to indicate a backend search.
   * @defaultValue false
   */
  asyncLoading?: boolean;
}

/**
 * A reusable dropdown component with built-in filtering and support for remote searching.
 *
 * @example
 * ```tsx
 * <SearchableSelect
 *   value={selectedId}
 *   onValueChange={setSelectedId}
 *   options={[{ id: '1', label: 'Option 1' }]}
 *   onSearch={(q) => fetchResults(q)}
 *   asyncLoading={isLoading}
 * />
 * ```
 */
export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  disabled = false,
  loading = false,
  loadingPlaceholder = "Loading...",
  emptyMessage = "No options found",
  moreText = "options",
  onSearch,
  asyncLoading = false,
}: SearchableSelectProps) {
  const [search, setSearch] = useState("");

  // Notify consumer of search changes for backend search
  useEffect(() => {
    if (onSearch) {
      onSearch(search);
    }
  }, [search, onSearch]);

  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.id === value);
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const query = search.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(query));
  }, [options, search]);

  const FILTER_DISPLAY_LIMIT = 5;

  return (
    <DropdownMenu onOpenChange={(open) => {
      if (!open) {
        setSearch("");
      }
    }}>
      <DropdownMenuTrigger
        disabled={disabled || loading}
        className="w-full h-11 bg-input/20 hover:bg-input/30 text-sm rounded-xl px-3 justify-between font-normal text-foreground inline-flex items-center cursor-pointer transition-all border border-border/50 outline-none focus:border-border/50"
      >
        <span className="truncate">
          {loading
            ? loadingPlaceholder
            : selectedOption
              ? selectedOption.label
              : placeholder}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="p-2 w-(--anchor-width)">
        {(search || options.length >= FILTER_DISPLAY_LIMIT) && (
          <div className="px-1 pb-2">
            <div className="relative">
              {asyncLoading ? (
                <Loader2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground animate-spin" />
              ) : (
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              )}
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 rounded-lg text-xs pl-8 pr-2"
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}
        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
          {filteredOptions.length === 0 ? (
            <div className="px-2 py-4 text-xs text-center text-muted-foreground">
              {emptyMessage} "{search}"
            </div>
          ) : (
            <>
              {filteredOptions.slice(0, FILTER_DISPLAY_LIMIT).map((opt) => {
                const isSelected = opt.id === value;
                return (
                  <DropdownMenuItem
                    key={opt.id}
                    onClick={() => {
                      onValueChange(opt.id);
                    }}
                    className={cn(
                      "rounded-lg my-0.5 cursor-pointer text-sm pl-2 pr-6 py-1.5 focus:bg-accent focus:text-accent-foreground",
                      isSelected && "bg-accent/50 font-semibold"
                    )}
                  >
                    <span className="truncate capitalize">{capitalize(opt.label)}</span>
                  </DropdownMenuItem>
                );
              })}
              {filteredOptions.length > FILTER_DISPLAY_LIMIT && (
                <div className="px-2 py-2 text-xs text-muted-foreground italic text-center border-t border-muted/50 mt-1">
                  And {filteredOptions.length - FILTER_DISPLAY_LIMIT} more {moreText}...
                </div>
              )}
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
