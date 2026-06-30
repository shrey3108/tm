/**
 * @module TranscriptPage
 * @component TranscriptPage
 *
 * Dashboard view for displaying and analyzing transcripts from candidate interviews or evaluations.
 */
import { useNavigate, useLocation } from "react-router-dom";
import { useTranscriptQuery } from "@/hooks/queries/candidates";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ArrowLeft, FileText, User, UserCheck } from "lucide-react";
import AppPageShell from "@/components/shared/AppPageShell";
import { DateDisplay } from "@/components/shared/DateDisplay";

/**
 * Page for viewing the full content of an interview transcript.
 * Displays the conversation in a dialogue format with speaker indicators.
 */
export default function TranscriptPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const transcriptId = location.state?.transcriptId;
  const candidateName = location.state?.candidateName;

  const { data: transcript, isLoading } = useTranscriptQuery(transcriptId);

  if (isLoading) {
    return (
      <AppPageShell width="wide">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground font-bold">Loading transcript...</p>
        </div>
      </AppPageShell>
    );
  }

  if (!transcript) {
    return (
      <AppPageShell width="wide">
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight">Transcript Not Found</h3>
            <Button variant="ghost" onClick={() => navigate(-1)} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell width="wide" className="pb-20">
      <div className="flex flex-col gap-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="h-10 w-10 p-0 rounded-xl hover:bg-primary/5"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-black tracking-tight uppercase">
                {candidateName ? `${candidateName}'s Transcript` : "Interview Transcript"}
              </h1>
              <p className="text-muted-foreground text-sm font-medium">
                <DateDisplay date={transcript.generated_at} />
              </p>
            </div>
          </div>

        </div>

        {/* Content Section */}
        <div className="flex gap-2">
          {/* Sidebar Info */}
          {/* <div className="lg:col-span-1 space-y-6">
            <Card className="rounded-3xl border-primary/10 shadow-lg bg-muted/20">
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Metadata</span>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-muted-foreground">ID</span>
                      <span className="font-mono text-[10px] bg-background px-2 py-0.5 rounded border">{transcript.id.split('-')[0]}...</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-muted-foreground">Status</span>
                      <Badge className="bg-green-500 hover:bg-green-600 font-bold">Processed</Badge>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-primary/5 space-y-4">
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">AI Insights</span>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                      This transcript was processed using advanced speech-to-text models and analyzed for key evaluation criteria.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div> */}

          {/* Dialogue Feed */}
          <div className="space-y-2">
            {transcript.segments?.dialogues && transcript.segments.dialogues.length > 0 ? (
              transcript.segments.dialogues.map((turn, index) => (
                <div
                  key={index}
                  className={`flex gap-4 p-2 rounded-lg border transition-all duration-300 ${turn.speaker.toLowerCase().includes('candidate')
                    ? 'bg-primary/5 border-primary/10 ml-8'
                    : 'bg-background border-muted-foreground/10 mr-8 shadow-sm'
                    }`}
                >
                  <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${turn.speaker.toLowerCase().includes('candidate')
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                    }`}>
                    {turn.speaker.toLowerCase().includes('candidate') ? <UserCheck className="h-5 w-5" /> : <User className="h-5 w-5" />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase">
                        {turn.speaker}
                      </span>
                    </div>
                    <p className="text-base font-medium leading-relaxed text-foreground/90">
                      {turn.text}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <Card className="rounded-3xl border-dashed border-2 flex items-center justify-center p-20">
                <p className="text-muted-foreground font-bold italic">No dialogue turns available for this transcript.</p>
              </Card>
            )}
            <div className="flex items-center justify-center">

              <Button
                onClick={() => {
                  navigate(-1)
                }}
                variant={"outline"}
              >Go Back</Button>
            </div>
          </div>
        </div>
      </div>
    </AppPageShell>
  );
}
