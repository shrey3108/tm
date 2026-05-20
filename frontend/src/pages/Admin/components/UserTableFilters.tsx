import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, X, Calendar as CalendarIcon, ChevronDown, UserCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn, capitalize } from "@/lib/utils";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components";

interface UserTableFiltersProps {
  searchFilter: string;
  setSearchFilter: (value: string) => void;
  statusFilter: string[];
  setStatusFilter: (value: string[]) => void;
  roleFilter: string[];
  setRoleFilter: (value: string[]) => void;
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  roleOptions: string[];
  hasActiveFilters: boolean;
  clearFilters: () => void;
  resultCount: number;
  totalCount: number;
  minDate: Date;
}

export const UserTableFilters = ({
  searchFilter,
  setSearchFilter,
  statusFilter,
  setStatusFilter,
  roleFilter,
  setRoleFilter,
  dateRange,
  setDateRange,
  roleOptions,
  hasActiveFilters,
  clearFilters,
  resultCount,
  totalCount,
  minDate,
}: UserTableFiltersProps) => {
  const statusOptions = ["active", "inactive"];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] items-center gap-3 p-3 bg-muted/30 rounded-2xl border border-muted-foreground/10 text-center">
      {/* User Search */}
      <div className="relative w-full lg:w-[320px]">
        <Input
          placeholder="Search name or email..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="pl-9 h-9 rounded-xl text-sm border-border/50 focus:ring-primary/20"
        />
        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      </div>

      <div className="grid grid-cols-2 lg:flex lg:flex-wrap lg:items-center gap-2 min-w-0">


        {/* Status Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "inline-flex items-center gap-2 h-9 px-3 rounded-xl border text-sm font-medium cursor-pointer select-none transition-colors",
              statusFilter.length > 0
                ? "border-primary/40 bg-primary/5 text-foreground"
                : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            {statusFilter.length === 0
              ? "Statuses"
              : statusFilter.length === 1
                ? capitalize(statusFilter[0])
                : `${statusFilter.length} statuses`}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[160px]">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {statusOptions.map((s) => (
                <DropdownMenuCheckboxItem
                  key={s}
                  checked={statusFilter.includes(s)}
                  onSelect={(e) => e.preventDefault()}
                  onClick={() =>
                    setStatusFilter(
                      statusFilter.includes(s)
                        ? statusFilter.filter((v) => v !== s)
                        : [...statusFilter, s]
                    )
                  }
                  closeOnClick={true} // close the dropdown after selecting option
                >
                  {capitalize(s)}
                </DropdownMenuCheckboxItem>
              ))}
              {statusFilter.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={false}
                    onClick={() => setStatusFilter([])}
                    closeOnClick={true} // close the dropdown after selecting option
                  >
                    Clear statuses
                  </DropdownMenuCheckboxItem>
                </>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Role Dropdown */}
        {roleOptions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "inline-flex items-center gap-2 h-9 px-3 rounded-xl border text-sm font-medium cursor-pointer select-none transition-colors",
                roleFilter.length > 0
                  ? "border-primary/40 bg-primary/5 text-foreground"
                  : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <UserCheck className="h-3.5 w-3.5 opacity-60" />
              {roleFilter.length === 0
                ? "Roles"
                : roleFilter.length === 1
                  ? roleFilter[0]
                  : `${roleFilter.length} roles`}
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[180px]">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Role</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {roleOptions.map((r) => (
                  <DropdownMenuCheckboxItem
                    key={r}
                    checked={roleFilter.includes(r)}
                    onSelect={(e) => e.preventDefault()}
                    onClick={() =>
                      setRoleFilter(
                        roleFilter.includes(r)
                          ? roleFilter.filter((v) => v !== r)
                          : [...roleFilter, r]
                      )
                    }
                    closeOnClick={true} // close the dropdown after selecting option
                  >
                    {r}
                  </DropdownMenuCheckboxItem>
                ))}
                {roleFilter.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={false}
                      onClick={() => setRoleFilter([])}
                      closeOnClick={true} // close the dropdown after selecting option
                    >
                      Clear roles
                    </DropdownMenuCheckboxItem>
                  </>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Date Range Picker */}
        <div className={cn(
          "flex items-center gap-1.5 px-1.5 h-9 rounded-xl border text-sm transition-colors w-fit",
          dateRange?.from
            ? "border-primary/40 bg-primary/5 text-foreground"
            : "border-input bg-background/50 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}>
          <Popover>
            <PopoverTrigger
              className={cn(
                "inline-flex items-center h-7 px-2 text-xs font-normal rounded-md bg-transparent hover:bg-transparent focus-visible:outline-none transition-colors",
                !dateRange?.from && "text-muted-foreground hover:text-foreground text-sm"
              )}
            >
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y")
                )
              ) : (
                <span className="text-xs">Created date range</span>
              )}
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0 rounded-2xl border bg-popover shadow-2xl ml-2 ring-1 ring-foreground/5 overflow-hidden"
              align="start"
            >
              <Calendar
                autoFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={1}
                disabled={{ after: new Date(), before: minDate }}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      {/* Clear Button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-destructive/5 transition-all"
          onClick={clearFilters}
        >
          <X className="h-3.5 w-3.5 mr-1.5" />
          Clear
        </Button>
      )}

      {/* Result Count */}
      <span className="text-xs font-medium flex items-center gap-2 justify-self-center">
        Total <span className="font-bold">{totalCount}</span> Users
        <Separator orientation="vertical" className="h-4  bg-gray-700 dark:bg-gray-300" />
        <span className="font-bold">{resultCount}</span> Users found
      </span>
    </div>
  );
};
