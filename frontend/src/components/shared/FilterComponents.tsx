import { useMemo, useState, type ReactNode } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { FILTER_DISPLAY_LIMIT } from "@/constants";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area"

interface CollapsibleFilterSectionProps {
  title: ReactNode;
  count?: number;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
  titleClassName?: string;
}

export function CollapsibleFilterSection({
  title,
  count = 0,
  children,
  defaultOpen = false,
  className,
  contentClassName,
  titleClassName,
}: CollapsibleFilterSectionProps) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className={cn(
        "border border-muted/30 rounded-xl overflow-hidden bg-card/40 transition-all duration-200 group/collapsible",
        className
      )}
    >
      <CollapsibleTrigger className="w-full flex items-center justify-between p-1.5 text-base font-semibold text-foreground hover:bg-muted/10 cursor-pointer select-none transition-colors">
        <div className={cn("flex items-center gap-2", titleClassName)}>
          <span>{title}</span>
          {count > 0 && (
            <span className="flex items-center justify-center bg-primary/10 text-primary text-xs font-bold rounded-full px-2 py-0.5">
              {count}
            </span>
          )}
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-open/collapsible:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className={cn("p-1.5 bg-muted/5 border-t border-muted/15 space-y-1", contentClassName)}>
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface CheckboxListFilterProps {
  options: { id: string; label: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  idPrefix: string;
  emptyText?: string;
  searchPlaceholder?: string;
  comboboxProps?: Record<string, any>;
  showSearchMore?: boolean;
}

export function CheckboxListFilter({
  options,
  selectedValues,
  onChange,
  idPrefix,
  emptyText = "No options available",
  showSearchMore = true,
}: CheckboxListFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const displayedOptions = useMemo(() => {
    if (isExpanded) {
      return options;
    }
    const selected = options.filter((opt) => selectedValues.includes(opt.id));
    const unselected = options.filter((opt) => !selectedValues.includes(opt.id));
    const combined = [...selected];
    const remainingLimit = Math.max(0, FILTER_DISPLAY_LIMIT - combined.length);
    combined.push(...unselected.slice(0, remainingLimit));
    return combined;
  }, [options, selectedValues, isExpanded]);

  const handleToggle = (id: string) => {
    if (selectedValues.includes(id)) {
      onChange(selectedValues.filter((item) => item !== id));
    } else {
      onChange([...selectedValues, id]);
    }
  };

  const hiddenCount = options.length - displayedOptions.length;

  return (
    <>
      <ScrollArea className="max-h-[240px] w-full pr-3 **:data-[slot=scroll-area-viewport]:max-h-[240px]">
        <div className="space-y-1">
          {displayedOptions.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2 text-center">
              {emptyText}
            </div>
          ) : (
            displayedOptions.map((opt) => (
              <div
                key={opt.id}
                className="flex items-center gap-2 py-1 px-1 hover:bg-muted/15 rounded-md transition-colors"
              >
                <Checkbox
                  id={`${idPrefix}-${opt.id}`}
                  checked={selectedValues.includes(opt.id)}
                  onCheckedChange={() => handleToggle(opt.id)}
                />
                <Label
                  htmlFor={`${idPrefix}-${opt.id}`}
                  className="text-xs cursor-pointer flex-1 select-none text-wrap"
                >
                  {opt.label}
                </Label>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {showSearchMore && hiddenCount > 0 && !isExpanded && (
        <div className="pt-2">
          <Button
            variant="ghost"
            className="w-full text-xs text-muted-foreground hover:text-foreground h-8"
            onClick={() => setIsExpanded(true)}
          >
            Show {hiddenCount} More
          </Button>
        </div>
      )}

      {showSearchMore && isExpanded && options.length > FILTER_DISPLAY_LIMIT && (
        <div className="pt-2">
          <Button
            variant="ghost"
            className="w-full text-xs text-muted-foreground hover:text-foreground h-8"
            onClick={() => setIsExpanded(false)}
          >
            Show Less
          </Button>
        </div>
      )}
    </>
  );
}
