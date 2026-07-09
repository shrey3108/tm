import { useFormContext } from "react-hook-form";
import { X } from "lucide-react";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const CustomFieldsSection = () => {
  const { control } = useFormContext();

  return (
    <div className="app-surface-card space-y-6 p-4 sm:p-5">
      <div className="space-y-1">
        <h2 className="text-lg font-bold tracking-tight">
          Custom Extraction Fields
        </h2>
        <p className="text-muted-foreground text-sm font-medium">
          Add specific information you want the AI to extract from resumes (e.g. "Notice Period", "Willingness to Relocate").
        </p>
      </div>

      <FormField
        control={control}
        name="custom_extraction_fields"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a field name and press enter..."
                    className="h-12 text-base rounded-xl border-muted-foreground/20 focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = e.currentTarget.value.trim();
                        if (val && !field.value?.includes(val)) {
                          field.onChange([...(field.value || []), val]);
                          e.currentTarget.value = "";
                        }
                      }
                    }}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {field.value?.map((item: string, index: number) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="pl-3 pr-2 py-1.5 text-sm rounded-xl bg-primary/10 text-primary border-none font-bold animate-in zoom-in duration-300 group"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() => {
                          const newVal = [...field.value];
                          newVal.splice(index, 1);
                          field.onChange(newVal);
                        }}
                        className="ml-2 hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </Badge>
                  ))}
                  {(!field.value || field.value.length === 0) && (
                    <p className="text-sm text-muted-foreground py-2">
                      No custom fields added yet.
                    </p>
                  )}
                </div>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
