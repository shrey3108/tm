import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Required } from "@/components/shared/Required";

export const JobSettingsSection = () => {
  const { control } = useFormContext();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
      {/* Passing Threshold */}
      <FormField
        control={control}
        name="passing_threshold"
        render={({ field }) => (
          <FormItem className="flex flex-row justify-between items-center rounded-2xl border border-muted-foreground/20 p-6 bg-card/10 backdrop-blur-sm hover:bg-card/20 transition-all shadow-sm">
            <div className="space-y-1 mb-4">
              <FormLabel className="text-lg font-bold">
                AI Passing Threshold
              </FormLabel>
              <p className="text-sm text-muted-foreground font-medium">
                Minimum matching score required for candidates.
              </p>
            </div>
            <FormControl>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  className="h-12 text-lg rounded-xl border-muted-foreground/20 focus:ring-2 focus:ring-primary/20 transition-all font-bold text-center w-24"
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />

              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="question_bank_passing_threshold"
        render={({ field }) => (
          <FormItem className="flex flex-row justify-between items-center rounded-2xl border border-muted-foreground/20 p-6 bg-card/10 backdrop-blur-sm hover:bg-card/20 transition-all shadow-sm">
            <div className="space-y-1 mb-4">
              <FormLabel className="text-lg font-bold">
                Question Passing Threshold
              </FormLabel>
              <p className="text-sm text-muted-foreground font-medium">
                Minimum score required for candidates.
              </p>
            </div>
            <FormControl>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  className="h-12 text-lg rounded-xl border-muted-foreground/20 focus:ring-2 focus:ring-primary/20 transition-all font-bold text-center w-24"
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />

              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Is Active Status */}
      <FormField
        control={control}
        name="is_active"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-2xl border border-muted-foreground/20 p-6 bg-card/10 backdrop-blur-sm hover:bg-card/20 transition-all shadow-sm">
            <div className="space-y-0.5">
              <FormLabel className="text-lg font-bold">
                Job Status <Required />
              </FormLabel>
              <p className="text-sm text-muted-foreground font-medium">
                Control visibility on the job board. Currently{" "}
                {field.value ? "Active" : "Inactive"}.
              </p>
            </div>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
};
