import { useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { X } from "lucide-react";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button"
import {
  JobFormSkeleton,
  BasicJobDetails,
  JobSettingsSection,
  CustomFieldsSection,
  SkillSelectorSection,
  StagePipelineSection,
} from "@/components/job-form";

import type { SkillBase } from "@/types/admin";
import { jobCreateSchema, type JobCreateFormValues } from "@/schemas/admin";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { extractErrorMessage } from "@/utils/error";
import { DEFAULT_PASSING_THRESHOLD } from "@/constants";
import { MoreJobSetting } from "@/components/job-form/MoreJobSetting";
import type { JobVersionMinimal } from "@/types/job";

// TanStack Query Hooks
import { useDepartment } from "@/hooks/queries/admin/useDepartment";
import { useJobPriorities } from "@/hooks/queries/admin/useJobPriority";
import { useJobPosition } from "@/hooks/queries/admin/useJobPosition";
import { useJobBySlugOrId } from "@/hooks/queries/jobs/useJob";
import { useCreateJobMutation, useUpdateJobMutation } from "@/hooks/mutations/jobs/useJobMutations";


export default function CreateJob() {
  const navigate = useNavigate();
  const { jobSlug } = useParams<{ jobSlug?: string }>();
  const location = useLocation();

  const isEditMode = !!jobSlug;

  const { data: departments, loading: deptsLoading } = useDepartment(0, 10);
  const { data: priorities, loading: prioritiesLoading } = useJobPriorities(0, 10);
  const { data: positions, loading: positionsLoading } = useJobPosition(0, 10);

  const jobIdFromState = (location.state as any)?.jobId;
  const jobQuery = useJobBySlugOrId(jobIdFromState, jobSlug, isEditMode);

  const job = jobQuery.data;
  const jobId = job?.id || null;
  const jobSkills = (job?.skills as SkillBase[]) || [];

  const isInitialLoading =
    deptsLoading ||
    prioritiesLoading ||
    positionsLoading ||
    (isEditMode && jobQuery.loading);

  const createJobMutation = useCreateJobMutation();
  const updateJobMutation = useUpdateJobMutation();
  const isSubmitting = createJobMutation.isPending || updateJobMutation.isPending;

  const form = useForm<JobCreateFormValues>({
    resolver: zodResolver(jobCreateSchema) as any,
    defaultValues: {
      title: "",
      vacancy: undefined,
      department_id: "",
      jd_text: "",
      is_active: true,
      skill_ids: [],
      passing_threshold: DEFAULT_PASSING_THRESHOLD,
      custom_extraction_fields: [],
      priority_id: "",
      position_id: "",
      stages: null,
      processing_version: undefined,
    },
  });

  useEffect(() => {
    if (jobQuery.error) {
      const errorMessage = extractErrorMessage(jobQuery.error);
      console.error("Failed to fetch job details:", jobQuery.error);
      toast.error(errorMessage || "Failed to load job details.");
      navigate("/dashboard/jobs");
    }
  }, [jobQuery.error, navigate]);

  useEffect(() => {
    if (job) {
      form.reset({
        title: job.title,
        vacancy: job.vacancy || undefined,
        department_id: job.department_id || "",
        jd_text: job.jd_text || "",
        is_active: job.is_active ?? true,
        skill_ids: job.skills?.map((s: any) => s.id) || [],
        passing_threshold: job.passing_threshold ?? DEFAULT_PASSING_THRESHOLD,
        custom_extraction_fields: job.custom_extraction_fields || [],
        priority_id: job.priority_id || "",
        position_id: job.position_id || "",
        processing_version: job.version || undefined,
      });
    }
  }, [job, form]);

  const onSubmit = (values: JobCreateFormValues) => {
    if (isEditMode && jobId) {
      // Omit stages from update payload as they are managed via specialized endpoints
      const { stages, ...updatePayload } = values as any;
      updateJobMutation.mutate(
        { jobId, data: updatePayload },
        {
          onSuccess: () => {
            toast.success("Job updated successfully!");
            navigate("/dashboard/jobs");
          },
          onError: (error) => {
            const errorMessage = extractErrorMessage(error);
            console.error("Failed to update job:", error);
            toast.error(errorMessage || "Failed to update job.");
          },
        }
      );
    } else {
      // For creation, values.stages is either:
      // - null (auto-setup 3 default rounds in backend)
      // - [] (no stages created)
      // - Array of {template_id, stage_order, is_mandatory, config}
      createJobMutation.mutate(values as any, {
        onSuccess: () => {
          toast.success("Job created successfully!");
          navigate("/dashboard/jobs");
        },
        onError: (error) => {
          const errorMessage = extractErrorMessage(error);
          console.error("Failed to create job:", error);
          toast.error(errorMessage || "Failed to create job.");
        },
      });
    }
  };



  return (
    <AppPageShell
      width="wide"
      gap="default"
      className="animate-in fade-in duration-500 bg-background"
    >
      <PageHeader
        title={isEditMode ? "Edit Job" : "Create Job"}
        actions={
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={() => navigate("/dashboard/jobs")}
            className="rounded-full hover:bg-muted"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </Button>
        }
      />

      <div className="mx-auto w-full">
        {isInitialLoading ? (
          <JobFormSkeleton />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <BasicJobDetails departments={departments} priorities={priorities} positions={positions} />
              <JobSettingsSection />
              <CustomFieldsSection />
              <SkillSelectorSection initialSelectedSkills={jobSkills} />
              <StagePipelineSection
                jobId={jobId}
                onChange={(stages) => form.setValue("stages" as any, stages)}
              />
              <MoreJobSetting jobId={jobId} versions={job?.job_versions as JobVersionMinimal[]} />

              {/* Form Actions */}
              <div className="flex flex-wrap items-center justify-center gap-4 border-t pt-8">
                <Button variant="default" type="submit" isLoading={isSubmitting}>
                  {isEditMode ? "Update" : "Create"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard/jobs")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        )}
      </div>
    </AppPageShell>
  );
}
