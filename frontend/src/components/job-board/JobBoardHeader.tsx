import { Button } from "@/components/";
// import AppPageHeader from "@/components/shared/AppPageHeader";
import { useNavigate } from "react-router-dom";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import PageHeader from "@/components/shared/PageHeader";
import { Plus } from "lucide-react";

/**
 * Page header for the Job Board, displaying the title, breadcrumbs, and a
 * "Create Job" button that navigates to `/dashboard/jobs/new`.
 */
export const JobBoardHeader = () => {
  const navigate = useNavigate();

  return (
    <PageHeader
      title="Job Board"
      breadcrumbActions={
        <PermissionGuard permissions={PERMISSIONS.JOBS_MANAGE} hideWhenDenied>
          <Button
            onClick={() => navigate("/dashboard/jobs/new")}
            size={"sm"}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Job
          </Button>
        </PermissionGuard>
      }
    />
  );
};
