import { Loader2, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,

  DropdownMenuLabel,
  DropdownMenuTrigger,

  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { StageTemplate } from "@/types/stage";

interface AddStageDropdownProps {
  availableTemplates: StageTemplate[];
  selectedTemplateIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onAdd: () => void;
  isAdding: boolean;
}

export const AddStageDropdown = ({
  availableTemplates,
  selectedTemplateIds,
  onSelectionChange,
  onAdd,
  isAdding,
}: AddStageDropdownProps) => {
  const toggleTemplate = (id: string) => {
    onSelectionChange(
      selectedTemplateIds.includes(id)
        ? selectedTemplateIds.filter((tid) => tid !== id)
        : [...selectedTemplateIds, id],
    );
  };

  return (
    <div className="flex items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button
            variant="outline"
            className="flex-1 h-10 rounded-xl border-muted-foreground/20 font-medium justify-between px-3"
            disabled={availableTemplates.length === 0}
          >
            <span className="truncate">
              {selectedTemplateIds.length === 0
                ? "Select stage templates..."
                : `${selectedTemplateIds.length} template(s) selected`}
            </span>
            <ChevronDown className="h-4 w-4 " />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80 rounded-xl border-primary/10 max-h-80 overflow-y-auto">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-bold text-xs text-muted-foreground">
              Available Templates
            </DropdownMenuLabel>
            {availableTemplates.map((t) => (
              <DropdownMenuCheckboxItem
                key={t.id}
                onClick={() => {
                  toggleTemplate(t.id);
                }}
                checked={selectedTemplateIds.includes(t.id)}
                className={cn(
                  "font-medium py-2.5 flex items-center justify-between gap-2",
                  selectedTemplateIds.includes(t.id) && "bg-primary/5",
                )}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-bold text-sm leading-tight">{t.name}</span>
                  {t.description && (
                    <span className="text-xs text-muted-foreground line-clamp-1 leading-tight">
                      {t.description}
                    </span>
                  )}
                </div>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
          {availableTemplates.length === 0 && (
            <div className="p-4 text-center text-xs text-muted-foreground italic">
              All templates assigned
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        type="button"
        size="sm"
        onClick={onAdd}
        disabled={selectedTemplateIds.length === 0 || isAdding}
        className="gap-2 h-10 px-6 rounded-xl shrink-0"
      >
        {isAdding ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Add {selectedTemplateIds.length > 0 && `(${selectedTemplateIds.length})`}
      </Button>
    </div>
  );
};
