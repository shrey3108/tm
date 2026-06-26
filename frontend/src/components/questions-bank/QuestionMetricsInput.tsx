import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Required } from "@/components/shared/Required";


interface QuestionMetricsInputProps {
  marks: number | "";
  onMarksChange: (value: number | "") => void;
  hours: number | "";
  onHoursChange: (value: number | "") => void;
  minutes: number | "";
  onMinutesChange: (value: number | "") => void;
  marksError?: string;
  durationError?: string;
  onClearMarksError?: () => void;
  onClearDurationError?: () => void;
  marksPlaceholder?: string;
  hoursPlaceholder?: string;
  minutesPlaceholder?: string;
  disabled?: boolean;
}

export function QuestionMetricsInput({
  marks,
  onMarksChange,
  hours,
  onHoursChange,
  minutes,
  onMinutesChange,
  marksError,
  durationError,
  onClearMarksError,
  onClearDurationError,
  marksPlaceholder = "10",
  hoursPlaceholder = "0",
  minutesPlaceholder = "30",
  disabled = false,
}: QuestionMetricsInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-3">
        {/* Marks */}
        <div className="flex flex-col gap-1 w-20">
          <Label className="text-xs font-semibold">Marks<Required /></Label>
          <Input
            type="number"
            placeholder={marksPlaceholder}
            min={1}
            value={marks}
            onChange={(e) => {
              const val = e.target.value === "" ? "" : Number(e.target.value);
              onMarksChange(val);
              if (marksError && onClearMarksError) {
                onClearMarksError();
              }
            }}
            disabled={disabled}
            aria-invalid={!!marksError}
            className="text-xs h-9 bg-background w-20 font-medium"
          />
        </div>

        {/* Hours */}
        <div className="flex flex-col gap-1 w-20">
          <Label className="text-xs font-semibold">Hours<Required /></Label>
          <Input
            type="number"
            placeholder={hoursPlaceholder}
            min={0}
            value={hours}
            onChange={(e) => {
              const val = e.target.value === "" ? "" : Number(e.target.value);
              onHoursChange(val);
              if (durationError && onClearDurationError) {
                onClearDurationError();
              }
            }}
            disabled={disabled}
            aria-invalid={!!durationError}
            className="text-xs h-9 bg-background w-20 font-medium"
          />
        </div>

        {/* Minutes */}
        <div className="flex flex-col gap-1 w-20">
          <Label className="text-xs font-semibold">Minutes<Required /></Label>
          <Input
            type="number"
            placeholder={minutesPlaceholder}
            min={0}
            max={59}
            value={minutes}
            onChange={(e) => {
              const val = e.target.value === "" ? "" : Number(e.target.value);
              onMinutesChange(val);
              if (durationError && onClearDurationError) {
                onClearDurationError();
              }
            }}
            disabled={disabled}
            aria-invalid={!!durationError}
            className="text-xs h-9 bg-background w-20 font-medium"
          />
        </div>
      </div>

      {/* Grouped Errors */}
      {(marksError || durationError) && (
        <div className="flex flex-col gap-0.5 mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
          {marksError && (
            <p className="text-xs font-semibold text-destructive">{marksError}</p>
          )}
          {durationError && (
            <p className="text-xs font-semibold text-destructive">{durationError}</p>
          )}
        </div>
      )}
    </div>
  );
}
