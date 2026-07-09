import { useState, useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { UserCheck, Users, Loader2 } from "lucide-react";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { useAssociates } from "@/hooks/queries/admin/useAssociate";
import type { AssociateRead } from "@/types/associate";
import { useDebouncedValue } from "@/hooks/useDebounced";
import { cn } from "@/lib/utils";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Required } from "@/components/shared/Required";
import { Checkbox } from "@/components/ui/checkbox";

interface AssociateSelectorSectionProps {
  initialSelectedAssociates?: AssociateRead[];
}

export const AssociateSelectorSection = ({
  initialSelectedAssociates = [],
}: AssociateSelectorSectionProps) => {
  const { control } = useFormContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssociates, setSelectedAssociates] = useState<AssociateRead[]>(initialSelectedAssociates);
  const debouncedQuery = useDebouncedValue(searchQuery);

  // Fetch associates list using debounced query
  const { data: associates, loading: loadingAssociates } = useAssociates({ skip: 0, limit: 100, q: debouncedQuery });

  // Keep selectedAssociates in sync with initialSelectedAssociates when it changes
  useEffect(() => {
    if (initialSelectedAssociates.length > 0) {
      setSelectedAssociates(initialSelectedAssociates);
    }
  }, [initialSelectedAssociates]);

  return (
    <Card className="border-muted/40 shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Assigned Associates <Required /></h2>
            <p className="text-sm text-muted-foreground">Select the associates who will be responsible for reviewing candidate submissions for this job.</p>
          </div>
        </div>

        <FormField
          control={control}
          name="associate_ids"
          render={({ field: { value = [], onChange } }) => (
            <FormItem className="space-y-4">
              <FormLabel className="sr-only">Associates</FormLabel>
              <FormControl>
                <div className="relative space-y-2">
                  <div className="flex items-center gap-2">
                    <SearchableSelect
                      multiple
                      loading={loadingAssociates}
                      value={value}
                      onValueChange={(nextValues) => {
                        onChange(nextValues);
                        setSelectedAssociates((prev) => {
                          const newSelection = nextValues.map((id) => {
                            const existing = prev.find((a) => a.id === id);
                            if (existing) return existing;
                            const found = associates.find((a) => a.id === id);
                            return found || { id, name: id, email: "" };
                          });
                          return newSelection;
                        });
                      }}
                      options={associates.map((r) => ({ id: r.id, label: r.name }))}
                      placeholder="Select Associates"
                      pluralLabel="associates"
                      onClear={() => {
                        onChange([]);
                        setSelectedAssociates([]);
                      }}
                      clearLabel="Clear associates"
                      icon={loadingAssociates ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5 opacity-60" />}
                      triggerClassName={cn(
                        "w-fit inline-flex items-center gap-2 h-10 px-4 rounded-xl border text-sm font-medium cursor-pointer select-none transition-colors bg-background border-muted/60 hover:bg-muted/10",
                      )}
                      contentClassName="min-w-[200px]"
                      onSearch={setSearchQuery}
                    />
                  </div>

                  {/* Display selected associates one by one */}
                  {value.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {value.map((id: string) => {
                        const assoc = selectedAssociates.find((a) => a.id === id);
                        return (
                          <div
                            key={id}
                            className="inline-flex items-center gap-1.5 bg-muted/40 border border-border/40 px-3 py-1 rounded-xl text-sm font-medium animate-in fade-in duration-200"
                          >
                            <UserCheck className="w-3.5 h-3.5 text-primary" />
                            <span className="text-foreground">{assoc ? assoc.name : id}</span>
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-destructive transition-colors text-xs font-bold ml-1.5 cursor-pointer"
                              onClick={() => {
                                const nextValues = value.filter((val: string) => val !== id);
                                onChange(nextValues);
                                setSelectedAssociates((prev) => prev.filter((a) => a.id !== id));
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="send_ai_evaluation_to_associate"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start gap-2 space-y-0 rounded-lg p-2">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  id="send_ai_evaluation_to_associate"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="text-sm font-medium leading-none cursor-pointer" htmlFor="send_ai_evaluation_to_associate">
                  Send AI evaluation to associate
                </FormLabel>
                <p className="text-xs text-muted-foreground">
                  Automatically share the generated AI evaluation report with the assigned associates when candidates submit their tasks.
                </p>
              </div>
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
};
