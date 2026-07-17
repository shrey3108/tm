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
          triggerClassName="h-12 text-base rounded-xl border-muted-foreground/20 focus:ring-2 focus:ring-primary/20 transition-all font-medium capitalize"
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
