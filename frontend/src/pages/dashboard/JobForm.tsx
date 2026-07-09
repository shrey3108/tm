/**
 * @module JobForm
 * @component JobForm
 *
 * Form component for creating or editing job post details.
 */
import { useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { X } from "lucide-react";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button"
// BasicJobDetails,
// JobSettingsSection,
// CustomFieldsSection,
// SkillSelectorSection,
// StagePipelineSection,
import { JobFormSkeleton } from "@/components/job/job-form/JobFormSkeleton";
import { BasicJobDetails } from "@/components/job/job-form/BasicJobDetails";
import { JobSettingsSection } from "@/components/job/job-form/JobSettingsSection";
import { StagePipelineSection } from "@/components/job/job-form/StagePipelineSection";
import { CustomFieldsSection } from "@/components/job/job-form/CustomFieldsSection";

import type { SkillBase } from "@/types/skill";
import { jobCreateSchema, type JobCreateFormValues } from "@/schemas/job";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { extractErrorMessage } from "@/utils/error";
import { DEFAULT_PASSING_THRESHOLD } from "@/constants";
import { MoreJobSetting } from "@/components/job/job-form/MoreJobSetting";
import type { JobVersionMinimal } from "@/types/job";
import type { AssociateRead } from "@/types/associate";
import { AssociateSelectorSection } from "@/components/job/job-form/AssociateSelectorSection";

// TanStack Query Hooks
import { useDepartment } from "@/hooks/queries/admin/useDepartment";
import { useJobPriorities } from "@/hooks/queries/admin/useJobPriority";
import { useJobPosition } from "@/hooks/queries/admin/useJobPosition";
import { useJobBySlugOrId } from "@/hooks/queries/jobs/useJob";
import { useCreateJobMutation, useUpdateJobMutation } from "@/hooks/mutations/jobs/useJobMutations";
import { useJobTask } from "@/hooks/queries/jobs/useJobTask";
import { useUploadJobTaskMutation, useDeleteJobTaskMutation } from "@/hooks/mutations/jobs/useJobTaskMutations";
import { SkillSelectorSection } from "@/components/job/job-form/SkillSelectorSection";


export default function CreateJob() {
  const navigate = useNavigate();
  const { jobSlug } = useParams<{ jobSlug?: string }>();
  const location = useLocation();

  const isEditMode = !!jobSlug;

  const { data: departments, loading: deptsLoading } = useDepartment({ skip: 0, limit: 100 });
  const { data: priorities, loading: prioritiesLoading } = useJobPriorities({ skip: 0, limit: 100 });
  const { data: positions, loading: positionsLoading } = useJobPosition({ skip: 0, limit: 10 });

  const jobIdFromState = (location.state as any)?.jobId;
  const jobQuery = useJobBySlugOrId(jobIdFromState, jobSlug, isEditMode);

  const job = jobQuery.data;
  const jobId = job?.id || null;
  const jobSkills = (job?.skills as SkillBase[]) || [];
  const jobAssociates = (job?.associates as AssociateRead[]) || [];

  const jobTaskQuery = useJobTask(jobId);
  const taskData = jobTaskQuery.data;

  const isInitialLoading =
    deptsLoading ||
    prioritiesLoading ||
    positionsLoading ||
    (isEditMode && (jobQuery.loading || jobTaskQuery.loading));

  const createJobMutation = useCreateJobMutation();
  const updateJobMutation = useUpdateJobMutation();
  const uploadJobTaskMutation = useUploadJobTaskMutation();
  const deleteJobTaskMutation = useDeleteJobTaskMutation();

  const isSubmitting =
    createJobMutation.isPending ||
    updateJobMutation.isPending ||
    uploadJobTaskMutation.isPending ||
    deleteJobTaskMutation.isPending;

  const form = useForm<JobCreateFormValues>({
    resolver: zodResolver(jobCreateSchema) as any,
    defaultValues: {
      title: "",
      vacancy: undefined,
      department_id: "",
      jd_text: "",
      is_active: true,
      skill_ids: [],
      skill_weightages: {},
      associate_ids: [],
      passing_threshold: DEFAULT_PASSING_THRESHOLD,
      question_bank_passing_threshold: DEFAULT_PASSING_THRESHOLD,
      custom_extraction_fields: [],
      priority_id: "",
      position_id: "",
      associate_reminder_hours: undefined,
      stages: null,
      processing_version: undefined,
      project_document: undefined,
      send_ai_evaluation_to_associate: true,
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
        skill_ids: job.skills?.map((s) => s.id) || [],
        skill_weightages: job.job_skill_weightages || {},
        associate_ids: job.associates?.map((a) => a.id) || [],
        passing_threshold: job.passing_threshold ?? DEFAULT_PASSING_THRESHOLD,
        question_bank_passing_threshold: job.question_bank_passing_threshold ?? DEFAULT_PASSING_THRESHOLD,
        custom_extraction_fields: job.custom_extraction_fields || [],
        priority_id: job.priority_id || "",
        position_id: job.position_id || "",
        associate_reminder_hours: job.associate_reminder_hours || undefined,
        processing_version: job.processing_version || undefined,
        project_document: taskData?.task_file_path || undefined,
        send_ai_evaluation_to_associate: job.send_ai_evaluation_to_associate ?? true,
      });
    }
  }, [job, taskData, form]);

  const onSubmit = async (values: JobCreateFormValues) => {
    const { project_document, ...formValues } = values as any;

    if (isEditMode && jobId) {
      // Omit stages and associate_reminder_hours from update payload
      const { stages, associate_reminder_hours, ...updatePayload } = formValues;
      updateJobMutation.mutate(
        { jobId, data: updatePayload },
        {
          onSuccess: async () => {
            try {
              if (project_document instanceof File) {
                await uploadJobTaskMutation.mutateAsync({ jobId, file: project_document });
              } else if (!project_document && taskData?.task_file_path) {
                await deleteJobTaskMutation.mutateAsync(jobId);
              }
              toast.success("Job updated successfully!");
              navigate("/dashboard/jobs");
            } catch (error) {
              console.error("Failed to update task document:", error);
              toast.error("Job updated, but failed to update task document.");
            }
          },
          onError: (error) => {
            const errorMessage = extractErrorMessage(error);
            console.error("Failed to update job:", error);
            toast.error(errorMessage || "Failed to update job.");
          },
        }
      );
    } else {
      // For creation, formValues.stages is either:
      // - null (auto-setup 3 default rounds in backend)
      // - [] (no stages created)
      // - Array of {template_id, stage_order, is_mandatory, config}
      createJobMutation.mutate(formValues, {
        onSuccess: async (newJob: any) => {
          try {
            if (project_document instanceof File && newJob?.id) {
              await uploadJobTaskMutation.mutateAsync({ jobId: newJob.id, file: project_document });
            }
            toast.success("Job created successfully!");
            if (newJob?.message) {
              toast.warning(newJob.message, {
                duration: 8000,
              });
            }
            navigate("/dashboard/jobs");
          } catch (error) {
            console.error("Failed to upload task document:", error);
            toast.error("Job created, but failed to upload task document.");
            if (newJob?.message) {
              toast.warning(newJob.message, {
                duration: 8000,
              });
            }
          }
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
              <BasicJobDetails departments={departments} priorities={priorities} positions={positions} isEditMode={isEditMode} />
              <JobSettingsSection />
              <CustomFieldsSection />
              <SkillSelectorSection initialSelectedSkills={jobSkills} />
              <AssociateSelectorSection initialSelectedAssociates={jobAssociates} />
              <StagePipelineSection
                jobId={jobId}
                onChange={(stages) => form.setValue("stages" as any, stages)}
              />
              <MoreJobSetting
                jobId={jobId}
                versions={job?.job_versions as JobVersionMinimal[]}
                taskSkills={taskData?.task_skills}
              />

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
