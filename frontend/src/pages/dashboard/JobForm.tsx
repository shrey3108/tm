import { useState, useEffect, useCallback } from "react";
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

import jobService from "@/apis/job";
import { adminDepartmentService } from "@/apis/admin/department";
import { adminJobPriorityService } from "@/apis/admin/jobPriority";
import { adminJobPositionService } from "@/apis/admin/jobPosition";
import type { DepartmentRead, JobPriorityRead, JobPositionRead, SkillBase } from "@/types/admin";
import { slugify } from "@/utils/slug";
import { jobCreateSchema, type JobCreateFormValues } from "@/schemas/admin";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { extractErrorMessage } from "@/utils/error";
import { DEFAULT_PASSING_THRESHOLD } from "@/constants";
import { MoreJobSetting } from "@/components/job-form/MoreJobSetting";
import type { Job, JobVersionMinimal } from "@/types/job";


export default function CreateJob() {
  const navigate = useNavigate();
  const { jobSlug } = useParams<{ jobSlug?: string }>();
  const location = useLocation();

  const [departments, setDepartments] = useState<DepartmentRead[]>([]);
  const [priorities, setPriorities] = useState<JobPriorityRead[]>([]);
  const [positions, setPositions] = useState<JobPositionRead[]>([]);
  const [jobSkills, setJobSkills] = useState<SkillBase[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const isEditMode = !!jobSlug;

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
  const fetchFormData = useCallback(async () => {
    try {
      const [deptRes, priorityRes, positionRes] = await Promise.all([
        adminDepartmentService.getAllDepartments(),
        adminJobPriorityService.getAllPriorities(),
        adminJobPositionService.getAllPositions(),
      ]);
      setDepartments(deptRes.data);
      setPriorities(priorityRes.data);
      setPositions(positionRes.data);
      return { departments: deptRes.data, priorities: priorityRes.data, positions: positionRes.data };
    } catch (error) {
      console.error("Failed to fetch form data:", error);
      toast.error("Failed to load departments, priorities or positions.");
      return null;
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsInitialLoading(true);
      try {
        await fetchFormData();

        if (isEditMode) {
          let id = (location.state as any)?.jobId;

          try {
            let jobData;
            if (id) {
              jobData = await jobService.getJob(id);
            } else {
              // Fallback: fetch all jobs and find by slug
              const allJobs = await jobService.getJobTitles();
              const job = allJobs.data.find((j) => slugify(j.title) === jobSlug); // match slug and attempt to find job
              id = job?.id;
              jobData = await jobService.getJob(id); // if job found fetch job details

              // If still not found error out
              if (!jobData) {
                toast.error("Job not found.");
                navigate("/dashboard/jobs");
                return;
              }

              id = jobData.id;
            }

            if (jobData) {
              setJobId(id);
              setJob(jobData);
              setJobSkills(jobData.skills as SkillBase[] || []);
              form.reset({
                title: jobData.title,
                vacancy: jobData.vacancy || undefined,
                department_id: jobData.department_id || "",
                jd_text: jobData.jd_text || "",
                is_active: jobData.is_active ?? true,
                skill_ids: jobData.skills?.map((s: any) => s.id) || [],
                passing_threshold: jobData.passing_threshold ?? DEFAULT_PASSING_THRESHOLD,
                custom_extraction_fields: jobData.custom_extraction_fields || [],
                priority_id: jobData.priority_id || "",
                position_id: jobData.position_id || "",
                processing_version: jobData.version || undefined,
              });
            }
          } catch (error) {
            const errorMessage = extractErrorMessage(error)
            console.error("Failed to fetch job details:", error);
            toast.error(errorMessage || "Failed to load job details.");
            navigate("/dashboard/jobs");
          }
        }
      } finally {
        setIsInitialLoading(false);
      }
    };
    init();
  }, [isEditMode, jobSlug, location.state, form, navigate, fetchFormData]);

  const onSubmit = async (values: JobCreateFormValues) => {
    setIsSubmitting(true);
    try {
      if (isEditMode && jobId) {
        // Omit stages from update payload as they are managed via specialized endpoints
        // sending stages: null or [] to PATCH /jobs/{id} might cause issues or unintended side effects
        const { stages, ...updatePayload } = values as any;
        await jobService.updateJob(jobId, updatePayload);
        toast.success("Job updated successfully!");
        navigate("/dashboard/jobs");
      } else {
        // For creation, values.stages is either:
        // - null (auto-setup 3 default rounds in backend)
        // - [] (no stages created)
        // - Array of {template_id, stage_order, is_mandatory, config}
        await jobService.createJob(values as any);
        toast.success("Job created successfully!");
        navigate("/dashboard/jobs");
      }
    } catch (error) {
      const errorMessage = extractErrorMessage(error)
      console.error("Failed to save job:", error);
      toast.error(
        isEditMode ? errorMessage || "Failed to update job." : errorMessage || "Failed to create job.",
      );
    } finally {
      setIsSubmitting(false);
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
