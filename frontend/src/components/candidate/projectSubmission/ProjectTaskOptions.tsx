import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { TaskOption } from "./ProjectSubmissionDialog";

interface ProjectTaskOptionsProps {
    taskOption: TaskOption;
    setTaskOption: (option: TaskOption) => void;
    form: any;
    fileInputRef: React.RefObject<HTMLInputElement | null>
}


/**
 * Renders the radio group options for selecting between default and new task files.
 */
export function ProjectTaskOptions({
    taskOption,
    setTaskOption,
    form,
    fileInputRef
}: ProjectTaskOptionsProps) {
    return <RadioGroup
        value={taskOption}
        onValueChange={(val: TaskOption) => {
            const option = val;
            setTaskOption(option);
            if (option === "existing") {
                form.setValue("pdfFile", undefined, { shouldValidate: true });
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2"
    >
        <Label
            className={`flex items-start gap-2 p-3 rounded-2xl border text-left cursor-pointer transition-all font-normal ${taskOption === "existing"
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-muted-foreground/15 bg-transparent hover:bg-muted/5"
                }`}
        >
            <RadioGroupItem value="existing" className="mt-0.5" />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-none text-foreground">Use Default Task</p>
            </div>
        </Label>
        <Label
            className={`flex items-start gap-2 p-3 rounded-2xl border text-left cursor-pointer transition-all font-normal ${taskOption === "new"
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-muted-foreground/15 bg-transparent hover:bg-muted/5"
                }`}
        >
            <RadioGroupItem value="new" className="mt-0.5" />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-none text-foreground">Upload New Task</p>
            </div>
        </Label>
    </RadioGroup>
}