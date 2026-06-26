import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TranscriptUpload } from "./TranscriptUpload";
import type { Job } from "@/types/job";
import { FieldLabel } from "@/components/ui/field";
interface Stage {
	stage: string;
	id: string;
}

interface StageControlsProps {
	/** Available stage names and IDs */
	stages: Stage[];
	/** Currently selected stage name */
	currentStage: string;
	/** Callback when stage selection changes */
	onStageChange: (stage: string) => void;
	/** Whether stages are loading */
	isLoadingStages: boolean;
	/** Current stage ID for transcript upload */
	stageId?: string;
	/** Associated job */
	job: Job;
	/** Whether a transcript is already uploaded */
	isUploaded?: boolean;
	/** Callback on successful transcript upload */
	onSuccess?: () => void;
}

/**
 * Stage selection controls with dropdown and transcript upload integration.
 * Sticky header that allows navigation between interview stages.
 */
export function StageControls({
	stages,
	currentStage,
	onStageChange,
	isLoadingStages,
	stageId,
	job,
	isUploaded,
	onSuccess
}: StageControlsProps) {
	return (
		<div className="flex flex-col border-b bg-background/50 backdrop-blur-md sticky top-0 z-10">
			<div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2 w-full">
				<div className="flex items-center gap-4">
					<div className="">
						<FieldLabel htmlFor="stage">Select Stage</FieldLabel>
						<Select
							value={currentStage}
							onValueChange={(value) => value && onStageChange(value)}
							disabled={isLoadingStages}
							id="stages"
							modal={false}
						>
							<SelectTrigger className="w-[400px] h-12 rounded-2xl border-primary/20 bg-background font-bold text-sm">
								<SelectValue placeholder={isLoadingStages ? "Loading stages..." : "Select Stage"} />
							</SelectTrigger>
							<SelectContent className="rounded-xl border-primary/10" alignItemWithTrigger={false}>
								{stages.map((s) => (
									<SelectItem key={s.id} value={s.stage} className="font-bold py-3">
										{s.stage}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				<TranscriptUpload
					stageId={stageId}
					className="w-full sm:max-w-xs"
					job={job}
					disabled={isUploaded}
					onSuccess={onSuccess}
				/>
			</div>
		</div>
	);
}

