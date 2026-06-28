import type { ReactElement } from "react";
import type { JobRead } from "@/types/admin";
import StatusBadge from "@/components/shared/StatusBadge";
import SkillsBadgeList from "@/components/shared/SkillsBadgeList";
import { Card } from "../ui/card";

interface JobSummaryCardProps {
  job: JobRead;
}

const JobSummaryCard = ({ job }: JobSummaryCardProps): ReactElement => {
  return (
    <Card className="mb-4 border-0 shadow-sm rounded-4 overflow-hidden">
      <div className="bg-muted px-4 py-2 border-b">
        <h6 className="text-sm font-bold uppercase text-muted-foreground mb-0 tracking-wide">
          Job Details Context
        </h6>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border-r border-border pr-4">
            <h6 className="text-sm font-bold uppercase text-muted-foreground mb-2 opacity-75">
              Department
            </h6>
            <div className="font-semibold text-foreground">
              {job.department?.name ?? job.department_name ?? "General"}
            </div>
          </div>
          <div className="border-r border-border pr-4">
            <h6 className="text-sm font-bold uppercase text-muted-foreground mb-2 opacity-75">
              Status
            </h6>
            <StatusBadge status={job.is_active} />
          </div>
          <div>
            <h6 className="text-sm font-bold uppercase text-muted-foreground mb-2 opacity-75">
              Required Skills
            </h6>
            <SkillsBadgeList skills={job.skills} />
          </div>
        </div>
      </div>
    </Card>
  );
};

export default JobSummaryCard;
