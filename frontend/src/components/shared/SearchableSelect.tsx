/**
 * @fileoverview A searchable dropdown component that provides an interactive UI for selecting
 * options from a list. It supports both local filtering and remote (async) searching, and both single/multi-select.
 */
import { useState, useMemo, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import { capitalize, cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
} from "@/components/ui/select";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { FILTER_DISPLAY_LIMIT } from "@/constants";

/**
 * Represents an individual selectable item in the search list.
 */
export interface Option {
  /** Unique identifier for the option. */
  id: string;
  /** Human-readable text displayed for the option. */
  label: string;
  /** Optional badge count to show next to the label. */
  badgeCount?: number;
  /** Optional hover card content to display on hover. */
  hoverContent?: React.ReactNode;
}

/**
 * Props for the {@link SearchableSelect} component.
 */
interface BaseProps {
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
  /** Optional icon to render inside the trigger button. */
  icon?: React.ReactNode;
  /** Optional className for styling the trigger button. */
  triggerClassName?: string;
  /** Optional className for styling the dropdown content. */
  contentClassName?: string;
  /** Optional callback triggered when clearing the selection. */
  onClear?: () => void;
  /** Label for the clear selection option. @defaultValue "Clear selection" */
  clearLabel?: string;
  /** Optional display limit. @defaultValue 5 */
  displayLimit?: number;
  /** Optional plural label used in default trigger formatting. */
  pluralLabel?: string;
  "aria-invalid"?: boolean;
}

interface SingleProps extends BaseProps {
  multiple?: false;
  /** The currently selected value (id). */
  value: string;
  /** Callback fired when a new option is selected. */
  onValueChange: (value: string) => void;
  getTriggerLabel?: (selected: Option) => string;
}

interface MultiProps extends BaseProps {
  multiple: true;
  /** The currently selected values (ids). */
  value: string[];
  /** Callback fired when the selection changes. */
  onValueChange: (value: string[]) => void;
  getTriggerLabel?: (selected: Option[]) => string;
}

export type SearchableSelectProps = SingleProps | MultiProps;

/**
 * A reusable dropdown component with built-in filtering and support for remote searching.
 * Supports both single-select and multi-select.
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
  icon,
  triggerClassName,
  contentClassName,
  onClear,
  clearLabel = "Clear selection",
  displayLimit = FILTER_DISPLAY_LIMIT,
  multiple = false,
  pluralLabel,
  getTriggerLabel,
  "aria-invalid": ariaInvalid,
}: SearchableSelectProps) {
  const [search, setSearch] = useState("");
  const [knownOptionsMap, setKnownOptionsMap] = useState<Record<string, Option>>({});

  // Keep a running map of all options seen by this component to preserve labels when options are filtered
  useEffect(() => {
    if (options && options.length > 0) {
      setKnownOptionsMap((prev) => {
        const next = { ...prev };
        let changed = false;
        options.forEach((opt) => {
          if (
            !next[opt.id] ||
            next[opt.id].label !== opt.label ||
            next[opt.id].hoverContent !== opt.hoverContent ||
            next[opt.id].badgeCount !== opt.badgeCount
          ) {
            next[opt.id] = opt;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [options]);

  // Notify consumer of search changes for backend search
  useEffect(() => {
    if (onSearch) {
      onSearch(search);
    }
  }, [search, onSearch]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const query = search.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(query));
  }, [options, search]);

  const selectedOptions = useMemo(() => {
    const getOption = (id: string) => {
      const found = options.find((opt) => opt.id === id);
      if (found) return found;
      if (knownOptionsMap[id]) return knownOptionsMap[id];
      return { id, label: id };
    };

    if (multiple) {
      const valArr = (value as string[]) || [];
      return valArr.map(getOption);
    } else {
      const valStr = value as string;
      if (!valStr) return [];
      return [getOption(valStr)];
    }
  }, [options, value, multiple, knownOptionsMap]);

  const triggerLabelText = useMemo(() => {
    if (multiple) {
      const valArr = (value as string[]) || [];
      if (valArr.length === 0) return placeholder;
      if (getTriggerLabel) {
        return (getTriggerLabel as (selected: Option[]) => string)(selectedOptions);
      }
      if (valArr.length === 1 && selectedOptions[0]) {
        return capitalize(selectedOptions[0].label);
      }
      return `${valArr.length} ${pluralLabel || placeholder}`;
    } else {
      if (!value) return placeholder;
      if (getTriggerLabel && selectedOptions[0]) {
        return (getTriggerLabel as (selected: Option) => string)(selectedOptions[0]);
      }
      if (loading) return loadingPlaceholder;
      return selectedOptions[0] ? selectedOptions[0].label : placeholder;
    }
  }, [multiple, value, selectedOptions, placeholder, pluralLabel, getTriggerLabel, loading, loadingPlaceholder]);
  const [open, setOpen] = useState(false);

  const hasSelection = multiple
    ? ((value as string[]) || []).length > 0
    : !!value;

  return (
    <Select
      value={value}
      onValueChange={onValueChange as any}
      multiple={multiple}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setSearch("");
        }
      }}
      modal={false}
    >
      <SelectTrigger
        disabled={disabled || loading}
        aria-invalid={ariaInvalid}
        className={cn(
          "w-full h-11 bg-input/20 hover:bg-input/30 text-sm rounded-xl px-3 justify-between font-normal text-foreground inline-flex items-center cursor-pointer transition-all border border-border/50 outline-none focus:border-border/50",
          triggerClassName
        )}
      >
        <span className="inline-flex items-center gap-2 truncate max-w-full">
          {icon}
          <span className="truncate capitalize">{triggerLabelText}</span>
        </span>
      </SelectTrigger>
      <SelectContent
        align="start"
        className={cn("p-2 min-w-(--anchor-width) w-max max-w-[min(calc(100vw-1rem),400px)]", contentClassName)}
        alignItemWithTrigger={false}
      >
        {(search || options.length >= displayLimit) && (
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
        <div className="max-h-75 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {filteredOptions.length === 0 ? (
            <div className="px-2 py-4 text-xs text-center text-muted-foreground">
              {emptyMessage}{search.trim() ? ` "${search}"` : ""}
            </div>
          ) : (
            <>
              {(() => {
                const slicedOptions = filteredOptions.slice(0, displayLimit);
                const slicedIds = new Set(slicedOptions.map(o => o.id));
                return (
                  <>
                    {slicedOptions.map((opt) => {
                      const isSelected = multiple
                        ? ((value as string[]) || []).includes(opt.id)
                        : opt.id === value;

                      const itemContent = (
                        <div className="flex items-center justify-between w-full">
                          <span className="truncate capitalize">{capitalize(opt.label)}</span>
                          {opt.badgeCount !== undefined && (
                            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold ml-2 shrink-0">
                              {opt.badgeCount}
                            </span>
                          )}
                        </div>
                      );

                      const renderOptionContent = () => {
                        if (opt.hoverContent) {
                          return (
                            <HoverCard>
                              <HoverCardTrigger delay={10} closeDelay={10} className="w-full truncate">
                                {itemContent}
                              </HoverCardTrigger>
                              <HoverCardContent className="w-fit px-3 py-1 text-xs" side="right" sideOffset={40}>
                                {opt.hoverContent}
                              </HoverCardContent>
                            </HoverCard>
                          );
                        }
                        return itemContent;
                      };

                      return (
                        <SelectItem
                          key={opt.id}
                          value={opt.id}
                          className={cn(
                            "rounded-lg my-0.5 cursor-pointer text-sm pl-2 pr-6 py-1 focus:bg-accent focus:text-accent-foreground",
                            isSelected && "bg-accent/50 font-semibold"
                          )}
                        >
                          {renderOptionContent()}
                        </SelectItem>
                      );
                    })}
                    {filteredOptions.length > displayLimit && (
                      <div className="px-2 py-2 text-xs text-muted-foreground italic text-center border-t border-muted/50 mt-1">
                        And {filteredOptions.length - displayLimit} more {moreText}...
                      </div>
                    )}
                    {/* Hidden items for selected values not in the current slice to prevent Base UI state loss */}
                    {selectedOptions.filter(opt => !slicedIds.has(opt.id)).map(opt => (
                      <SelectItem key={`hidden-${opt.id}`} value={opt.id} className="hidden" aria-hidden="true" disabled>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </>
                );
              })()}
            </>
          )}
        </div>
        {hasSelection && onClear && (
          <>
            <SelectSeparator />
            <div
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
                setOpen(false);
              }}
              className="rounded-xl cursor-pointer text-destructive hover:bg-destructive/10 px-3 py-2 text-sm select-none transition-colors"
            >
              {clearLabel}
            </div>
          </>
        )}
      </SelectContent>
    </Select>
  );
}
