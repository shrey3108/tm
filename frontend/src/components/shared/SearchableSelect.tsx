import { useState, useMemo } from "react";
import { ChevronDown, Search } from "lucide-react";
import { capitalize, cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Option {
  id: string;
  label: string;
}

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  loading?: boolean;
  loadingPlaceholder?: string;
  emptyMessage?: string;
  moreText?: string;
}

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
}: SearchableSelectProps) {
  const [search, setSearch] = useState("");

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
        {options.length >= FILTER_DISPLAY_LIMIT && (
          <div className="px-1 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
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
                    <span className="truncate">{capitalize(opt.label)}</span>
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
