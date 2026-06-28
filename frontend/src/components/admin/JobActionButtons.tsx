import { Button } from "@/components/ui/button";
import QuickResumeUpload from "@/components/candidate/QuickResumeUpload";
import type { JobRead } from "@/types/admin";

interface JobActionButtonsProps {
  job: JobRead;
  onViewCandidates: (jobId: string) => void;
  onEdit: (job: JobRead) => void;
  onDelete: (job: JobRead) => void;
}

const JobActionButtons = ({ job, onViewCandidates, onEdit, onDelete }: JobActionButtonsProps) => {
  return (
    <div className="flex gap-2 justify-end items-center flex-nowrap">
      <QuickResumeUpload jobId={job.id} jobTitle={job.title} size="sm" />
      <Button
        variant="outline"
        size="sm"
        className="flex-shrink-0"
        onClick={() => onViewCandidates(job.id)}
      >
        Candidates
      </Button>
      <Button variant="secondary" size="sm" className="flex-shrink-0" onClick={() => onEdit(job)}>
        Edit
      </Button>
      <Button
        variant="destructive"
        size="sm"
        className="flex-shrink-0"
        onClick={() => onDelete(job)}
      >
        Delete
      </Button>
    </div>
  );
};

export default JobActionButtons;
