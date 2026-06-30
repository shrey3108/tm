/**
 * @module AssignAssociatePage
 * @component AssignAssociatePage
 *
 * Hiring manager dashboard page for assigning associates to candidate review cycles.
 */
import { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { UserPlus, ArrowLeft, Loader2, UserCheck } from "lucide-react";
import AppPageShell from "@/components/shared/AppPageShell";
import AppPageHeader from "@/components/shared/AppPageHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
// import {
//   InputGroup,
//   InputGroupAddon,
//   InputGroupInput,
// } from "@/components/ui/input-group";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import {
  useResolvedJobAndCandidate,
  useCandidateAssociateResultsQuery,
} from "@/hooks/queries/candidates/useCandidateStagesQueries";
import { useAssociates } from "@/hooks/queries/admin/useAssociate";
import { slugify, unSlugify } from "@/utils/slug";
import { assignAssociateSchema, type AssignAssociateFormValues } from "@/schemas/candidate";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebounced";
import { useSendToAssociatesMutation } from "@/hooks/mutations/candidates/useCandidateStages";
import type { AssociateRead } from "@/types/associate";
import { extractErrorMessage } from "@/utils/error";

export default function AssignAssociatePage() {
  const params = useParams<{
    jobSlug: string;
    candidateName: string;
    stageSlug: string;
  }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssociates, setSelectedAssociates] = useState<AssociateRead[]>([]);
  const debouncedQuery = useDebouncedValue(searchQuery);

  const { job, candidate, isLoading } = useResolvedJobAndCandidate(
    params.jobSlug,
    params.candidateName,
    location.state?.job,
    location.state?.candidate
  );

  const candidateStage = candidate?.pipeline?.find(
    (s) => slugify(s.template_name) === params.stageSlug
  );
  const stageId = candidateStage?.stage_id;
  const { data: existingAssociateResults } = useCandidateAssociateResultsQuery(stageId);
  const sendToAssociatesMutation = useSendToAssociatesMutation();

  const candidateName = candidate
    ? `${candidate.first_name} ${candidate.last_name}`
    : params.candidateName
      ? unSlugify(params.candidateName)
      : "Candidate";

  // Fetch associates list using debounced query
  const { data: associates, loading: loadingAssociates } = useAssociates(0, 100, debouncedQuery);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isValid, isSubmitting },
  } = useForm<AssignAssociateFormValues>({
    resolver: zodResolver(assignAssociateSchema),
    defaultValues: {
      associates: [],
      // workdriveLink: "",
      stageId: "",
    },
    mode: "onChange",
  });

  useEffect(() => {
    if (stageId) {
      setValue("stageId", stageId, { shouldValidate: true });
    } else {
      setValue("stageId", "", { shouldValidate: true });
    }
  }, [stageId, setValue]);

  const onSubmit = async (data: AssignAssociateFormValues) => {
    try {
      // 1. Submit/save the workdrive link (saves link as github_url)
      // await evaluateGithubMutation.mutateAsync({
      //   stageId: data.stageId,
      //   // githubUrl: data.workdriveLink,
      // });

      // 2. Send the paper to the selected associates
      await sendToAssociatesMutation.mutateAsync({
        stageId: data.stageId,
        payload: {
          associate_ids: data.associates,
        },
      });

      toast.success("Associate(s) successfully assigned!");
      navigate(-1);
    } catch (err: any) {
      const errMsg = extractErrorMessage(err, "Failed to assign associates.");
      console.error(errMsg);
      toast.error(errMsg);
    }
  };

  const data = [
    { lable: "Job Name", value: isLoading ? "Loading..." : (job?.title || "N/A"), },
    { lable: "Candidate Name", value: isLoading ? "Loading..." : candidateName, },
    { lable: "Position Name", value: isLoading ? "Loading..." : (job?.position?.name || job?.title || "N/A"), },
    { lable: "Department Name", value: isLoading ? "Loading..." : (job?.department_name || "N/A"), },
  ]

  return (
    <AppPageShell width="full" className="p-0 bg-background">
      <AppPageHeader
        headingClassName="text-lg sm:text-xl capitalize"
        title={`Assign Associates for ${candidateName}`}
        meta={
          <div className="flex items-center gap-2">
            {job && <span className="font-semibold text-muted-foreground capitalize text-base">{job.title}</span>}
            {job && <span className="text-muted-foreground">•</span>}
            <span className="font-semibold text-blue-500 capitalize text-base">
              {job?.department_name || "Department"}
            </span>
          </div>
        }
        breadcrumbActions={
          <Button
            variant="ghost"
            size="sm"
            className="h-9 rounded-xl border border-muted-foreground/10 px-3 font-semibold gap-1.5"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        }
      />

      <div className="p-2 space-y-2">
        {/* Candidate & Job Details Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {data.map((d) => (
            <div key={d.lable} className="p-1.5 bg-muted/30 border border-border/40 rounded-xl flex flex-col justify-between">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{d.lable}</span>
              <span className="text-sm font-semibold truncate mt-1 text-foreground">
                {d.value}
              </span>
            </div>
          ))}

        </div>

        {/* Main Assignment Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="bg-card/50 border border-border/40 rounded-2xl p-2 space-y-2 shadow-sm">
          {/* Multi-select Dropdown for Associates */}
          <div className="space-y-2">
            <Label htmlFor="associates-select" className="text-sm font-semibold text-foreground">
              Associates
            </Label>

            <Controller
              control={control}
              name="associates"
              render={({ field: { value, onChange } }) => (
                <div className="relative space-y-2">
                  <SearchableSelect
                    multiple
                    loading={loadingAssociates}
                    value={value}
                    onValueChange={(nextValues) => {
                      onChange(nextValues);
                      setSelectedAssociates((prev) => {
                        const newSelection = nextValues.map((id) => {
                          const existing = prev.find((a) => a.id === id);
                          if (existing) return existing;
                          const found = associates.find((a) => a.id === id);
                          return found || { id, name: id, email: "" };
                        });
                        return newSelection;
                      });
                    }}
                    options={associates.map((r) => ({ id: r.id, label: r.name }))}
                    placeholder="Associates"
                    pluralLabel="associates"
                    onClear={() => {
                      onChange([]);
                      setSelectedAssociates([]);
                    }}
                    clearLabel="Clear associates"
                    icon={<UserCheck className="h-3.5 w-3.5 opacity-60" />}
                    triggerClassName={cn(
                      "w-fit inline-flex items-center gap-2 h-9 px-2 rounded-xl border text-sm font-medium cursor-pointer select-none transition-colors",
                    )}
                    contentClassName="min-w-[150px]"
                    onSearch={setSearchQuery}
                  />

                  {/* Display selected associates one by one */}
                  {value.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {value.map((id: string) => {
                        const assoc = selectedAssociates.find((a) => a.id === id);
                        return (
                          <div
                            key={id}
                            className="inline-flex items-center gap-1.5 bg-muted/40 border border-border/40 px-2.5 py-1 rounded-xl text-sm font-medium"
                          >
                            <UserCheck className="w-3.5 h-3.5 text-primary" />
                            <span>{assoc ? assoc.name : id}</span>
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-destructive transition-colors text-xs font-bold ml-1 cursor-pointer"
                              onClick={() => {
                                const nextValues = value.filter((val) => val !== id);
                                onChange(nextValues);
                                setSelectedAssociates((prev) => prev.filter((a) => a.id !== id));
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {existingAssociateResults?.reviews && existingAssociateResults.reviews.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Existing: {existingAssociateResults.reviews.map((r) => r.associate_name).join(", ")}
                    </div>
                  )}
                </div>
              )}
            />
            {errors.associates && (
              <p className="text-xs text-destructive font-medium mt-1">{errors.associates.message}</p>
            )}
          </div>

          {/* Workdrive Link Input */}
          {/* <div className="space-y-2">
            <Label htmlFor="workdrive-input" className="text-sm font-semibold text-foreground">
              Workdrive Link
            </Label>
            <InputGroup className="h-10 rounded-xl border border-input bg-input/30 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
              <InputGroupAddon align="inline-start" className="pl-3 pr-1 text-muted-foreground">
                <Globe className="w-4 h-4" />
              </InputGroupAddon>
              <Controller
                control={control}
                name="workdriveLink"
                render={({ field }) => (
                  <InputGroupInput
                    {...field}
                    id="workdrive-input"
                    className="placeholder:text-muted-foreground/60 h-6 text-sm"
                    placeholder="https://workdrive.zoho.com/..."
                  />
                )}
              />
            </InputGroup>
            {errors.workdriveLink && (
              <p className="text-xs text-destructive font-medium mt-1">{errors.workdriveLink.message}</p>
            )}
          </div> */}

          {errors.stageId && (
            <p className="text-xs text-destructive font-medium">{errors.stageId.message}</p>
          )}

          {/* Form Action Button */}
          <Button
            type="submit"
            className="w-full h-10 rounded-xl font-semibold gap-2 mt-2"
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Assign Associate
              </>
            )}
          </Button>
        </form>
      </div>
    </AppPageShell>
  );
}
