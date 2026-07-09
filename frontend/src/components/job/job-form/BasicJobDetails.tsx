import { useFormContext } from "react-hook-form";
import {
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import type { JobPositionRead } from "@/types/jobPosition";
import type { JobPriorityRead } from "@/types/jobPriority";
import type { DepartmentRead } from "@/types/department"
import { Required } from "@/components/shared/Required";
import { addDays } from "date-fns";
import { DateDisplay } from "@/components/shared/DateDisplay";
interface BasicJobDetailsProps {
  departments: DepartmentRead[];
  priorities?: JobPriorityRead[];
  positions: JobPositionRead[];
  isEditMode?: boolean;
}

export const BasicJobDetails = ({ departments, priorities = [], positions, isEditMode = false }: BasicJobDetailsProps) => {
  const { control, setValue } = useFormContext();

  return (
    <div className="grid gap-6">
      {/* Job Title */}
      <FormField
        control={control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-lg font-semibold text-foreground">
              Title <Required />
            </FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. Senior Frontend Developer"
                className="text-base rounded-xl border-muted-foreground/20 focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Job Position, Priority, Reminder Hours, Department, Vacancy Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* Job Position */}
        <FormField
          control={control}
          name="position_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-lg font-semibold text-foreground">
                Job Position <Required />
              </FormLabel>
              <FormControl>
                <SearchableSelect
                  value={field.value}
                  onValueChange={field.onChange}
                  options={positions.map((pos) => ({ id: pos.id, label: pos.name }))}
                  placeholder="Select job position"
                  searchPlaceholder="Search job position..."
                  triggerClassName="h-12 text-base rounded-xl border-muted-foreground/20 focus:ring-2 focus:ring-primary/20 transition-all font-medium w-full capitalize"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Priority */}
        <FormField
          control={control}
          name="priority_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-lg font-semibold text-foreground">
                Job Priority <Required />
              </FormLabel>
              <FormControl>
                <SearchableSelect
                  value={field.value || ""}
                  onValueChange={(val) => {
                    field.onChange(val);
                    const selectedPriority = priorities.find((p) => p.id === val);
                    if (selectedPriority && selectedPriority.associate_reminder_hours !== undefined && !isEditMode) {
                      setValue("associate_reminder_hours", selectedPriority.associate_reminder_hours);
                    }
                  }}
                  options={priorities.map((p) => ({
                    id: p.id,
                    label: `${p.name} (${p.duration_days} days)`,
                  }))}
                  placeholder="Select priority"
                  searchPlaceholder="Search priority..."
                  triggerClassName="h-12 text-base rounded-xl border-muted-foreground/20 focus:ring-2 focus:ring-primary/20 transition-all font-medium w-full capitalize"
                />
              </FormControl>
              <FormDescription className="flex flex-col gap-2">
                {field.value && <span className="gap-2">
                  <span className="">Due Date:</span>{" "}
                  <DateDisplay
                    date={field.value ? addDays(new Date(), Number(priorities.find((p) => p.id === field.value)?.duration_days)) : null}
                    className="font-bold text-black dark:text-white"
                  />
                </span>}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Associate Reminder Hours */}
        <FormField
          control={control}
          name="associate_reminder_hours"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-lg font-semibold text-foreground">
                Reminder (Hours) <Required />
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={24}
                  step={24}
                  disabled={isEditMode}
                  placeholder="e.g. 24"
                  className="text-base rounded-xl border-muted-foreground/20 focus:ring-2 focus:ring-primary/20 transition-all font-medium disabled:opacity-50"
                  value={field.value !== null && field.value !== undefined ? field.value : ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    field.onChange(val ? parseInt(val, 10) : null);
                  }}
                />
              </FormControl>
              <FormDescription>
                Frequency of reminder emails send to the associates
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Department */}
        <FormField
          control={control}
          name="department_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-lg font-semibold text-foreground">
                Department <Required />
              </FormLabel>
              <FormControl>
                <SearchableSelect
                  value={field.value}
                  onValueChange={field.onChange}
                  options={departments.map((dept) => ({ id: dept.id, label: dept.name }))}
                  placeholder="Select department"
                  searchPlaceholder="Search department..."
                  triggerClassName="h-12 text-base rounded-xl border-muted-foreground/20 focus:ring-2 focus:ring-primary/20 transition-all font-medium w-full capitalize"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Vacancy */}
        <FormField
          control={control}
          name="vacancy"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-lg font-semibold text-foreground">
                Vacancy <Required />
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 5"
                  className="text-base rounded-xl border-muted-foreground/20 focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                  value={field.value !== null && field.value !== undefined ? field.value : ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    field.onChange(val ? parseInt(val, 10) : null);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Job Description */}
      <FormField
        control={control}
        name="jd_text"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-lg font-semibold text-foreground">
              Job Description <Required />
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder="Detailed job description..."
                className="min-h-62.5 text-base rounded-2xl p-5 border-muted-foreground/20 focus:ring-2 focus:ring-primary/20 transition-all resize-none font-medium"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
