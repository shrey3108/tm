import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
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
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 max-w-[320px]">
        <SearchableSelect
          multiple
          options={availableTemplates.sort((a, b) => (a.default_order ?? 0) - (b.default_order ?? 0)).map((t) => ({
            id: t.id,
            label: t.name,
            hoverContent: t.description,
          }))}
          value={selectedTemplateIds}
          onValueChange={onSelectionChange}
          placeholder="Select stage templates..."
          pluralLabel="template(s) selected"
          disabled={availableTemplates.length === 0}
          emptyMessage="No templates found"
          triggerClassName="h-9 w-full min-w-0 rounded-4xl border border-input bg-input/30 px-3 py-1 text-base transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
        />
      </div>

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
