import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { transcriptService } from "@/apis/transcript"
import { toast } from "sonner"
import { Loader2, FolderOpen } from "lucide-react"
import { extractErrorMessage } from "@/utils/error"
import { DirectoryPathSchema, type DirectoryPathFormValues } from "@/schemas/file"

interface DefaultPathDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DefaultPathDialog({ open, onOpenChange }: DefaultPathDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<DirectoryPathFormValues>({
    resolver: zodResolver(DirectoryPathSchema),
    defaultValues: {
      path: "",
    },
    mode: "onChange",
  })

  useEffect(() => {
    if (open) {
      const fetchDefaultPath = async () => {
        setIsLoading(true)
        try {
          const response = await transcriptService.getDefaultTranscriptPath()
          form.reset({ path: response.default_path || "" })
        } catch (error: any) {
          toast.error("Failed to fetch default path")
        } finally {
          setIsLoading(false)
        }
      }
      fetchDefaultPath()
    } else {
      form.reset()
    }
  }, [open, form])

  const onSubmit = async (values: DirectoryPathFormValues) => {
    setIsSaving(true)
    try {
      await transcriptService.updateDefaultTranscriptPath(values.path)
      toast.success("Default path updated successfully")
      onOpenChange(false)
    } catch (error: unknown) {
      const errorMessage = extractErrorMessage(error)
      toast.error(errorMessage || "Failed to update default path")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg flex flex-col p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-muted-foreground/20 shadow-2xl rounded-2xl">
        <DialogHeader className="p-4 pb-2 border-b border-muted-foreground/10 bg-muted/30">
          <DialogTitle className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            Extraction Path
          </DialogTitle>
          <DialogDescription className="text-sm">
            Set the default local directory path for transcript processing.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 space-y-4 py-4">
            <FormField
              control={form.control}
              name="path"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-sm font-semibold text-foreground/80">
                    Directory Path
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="e.g. C:\Users\Documents\transcibe"
                        className="h-11 rounded-xl bg-background/50 border-muted-foreground/20 focus:ring-primary/20 pr-10"
                        {...field}
                        disabled={isLoading || isSaving}
                      />
                      {isLoading && (
                        <div className="absolute right-3 top-3">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground/70 italic px-1">
                    This path will be used as the base directory for file selection in the platform.
                  </p>
                </FormItem>
              )}
            />

            <DialogFooter className="p-0 pt-2 bg-transparent border-none">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
                className="rounded-xl border-muted-foreground/20 hover:bg-background/80"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={isSaving}
                disabled={isLoading || !form.formState.isValid}
                className="rounded-xl px-8 bg-primary hover:bg-primary/90"
              >
                Save Path
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
