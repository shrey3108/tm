import { useFormContext } from "react-hook-form";
import {
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/components";
import type { DepartmentRead, JobPriorityRead, JobPositionRead } from "@/types/admin";
import { Required } from "@/components/shared/Required";
import { addDays } from "date-fns";
import { DateDisplay } from "@/components/shared/DateDisplay";
interface BasicJobDetailsProps {
  departments: DepartmentRead[];
  priorities?: JobPriorityRead[];
  positions: JobPositionRead[];
}

export const BasicJobDetails = ({ departments, priorities = [], positions }: BasicJobDetailsProps) => {
  const { control } = useFormContext();

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

      {/* Job Position, Priority, Department, Vacancy Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Job Position */}
        <FormField
          control={control}
          name="position_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-lg font-semibold text-foreground">
                Job Position <Required />
              </FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="h-12 text-base rounded-xl border-muted-foreground/20 focus:ring-2 focus:ring-primary/20 transition-all font-medium w-full">
                    <SelectValue placeholder="Select job position" className="w-full capitalize">
                      {
                        positions.find(
                          (pos) => pos.id === field.value,
                        )?.name
                      }
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="rounded-xl shadow-xl border-muted-foreground/10">
                  {positions.map((pos) => (
                    <SelectItem
                      key={pos.id}
                      value={pos.id}
                      className="py-3 text-base font-medium w-full capitalize"
                    >
                      {pos.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Select onValueChange={field.onChange} value={field.value || ""} >
                <FormControl>
                  <SelectTrigger className="h-12 text-base rounded-xl border-muted-foreground/20 focus:ring-2 focus:ring-primary/20 transition-all font-medium w-full ">
                    <SelectValue placeholder="Select priority" className="w-full">
                      {(() => {
                        const priority = priorities.find((p) => p.id === field.value);
                        return priority ? `${priority.name} (${priority.duration_days} days)` : null;
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="rounded-xl shadow-xl border-muted-foreground/10">
                  {priorities.map((p) => (
                    <SelectItem
                      key={p.id}
                      value={p.id}
                      className="py-3 text-base font-medium w-full capitalize"
                    >
                      {p.name} ({p.duration_days} days)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription className="flex flex-col gap-2">
                {field.value && <span className="gap-2">
                  <span className="">Due Date:</span>{" "}
                  <DateDisplay
                    date={field.value ? addDays(new Date(), Number(priorities.find((p) => p.id === field.value)?.duration_days)) : null}
                    className="font-bold"

                  />
                </span>}
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
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="h-12 text-base rounded-xl border-muted-foreground/20 focus:ring-2 focus:ring-primary/20 transition-all font-medium w-full capitalize">
                    <SelectValue placeholder="Select department" className="w-full capitalize">
                      {
                        departments.find(
                          (dept) => dept.id === field.value,
                        )?.name
                      }
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="rounded-xl shadow-xl border-muted-foreground/10">
                  {departments.map((dept) => (
                    <SelectItem
                      key={dept.id}
                      value={dept.id}
                      className="py-3 text-base font-medium w-full capitalize"
                    >
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  className=" text-base rounded-xl border-muted-foreground/20 focus:ring-2 focus:ring-primary/20 transition-all font-medium"
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
