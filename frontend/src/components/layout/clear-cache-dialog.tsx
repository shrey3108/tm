import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { adminSystemService } from "@/apis/admin/admin-system"
import { toast } from "sonner"
import { Loader2, Search } from "lucide-react"
import { extractErrorMessage } from "@/utils/error"

interface ClearCacheDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ClearCacheDialog({ open, onOpenChange }: ClearCacheDialogProps) {
  const [availableKeys, setAvailableKeys] = useState<string[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [isLoadingKeys, setIsLoadingKeys] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const fetchKeys = useCallback(async () => {
    setIsLoadingKeys(true)
    try {
      const response = await adminSystemService.getAllKeys()
      if (response.success) {
        setAvailableKeys(() => response.data.keys.filter((key) => !key.includes("_kombu") && !key.includes("_celery"))) // remove celery and kombu keys
      }
    } catch (error: any) {
      toast.error("Failed to fetch cache keys")
    } finally {
      setIsLoadingKeys(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchKeys()
      setSelectedKeys(new Set())
      setSearchQuery("")
    }
  }, [open, fetchKeys])

  const filteredKeys = availableKeys.filter((key) =>
    key.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleKey = (key: string) => {
    const newSelected = new Set(selectedKeys)
    if (newSelected.has(key)) {
      newSelected.delete(key)
    } else {
      newSelected.add(key)
    }
    setSelectedKeys(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedKeys.size === filteredKeys.length && filteredKeys.length > 0) {
      setSelectedKeys(new Set())
    } else {
      setSelectedKeys(new Set(filteredKeys))
    }
  }

  const handleClear = async () => {
    setIsClearing(true)
    const keysToClear = Array.from(selectedKeys)

    try {
      if (keysToClear.length === 0) {
        // Clear everything if nothing selected
        await adminSystemService.clearCache()
        toast.success("System cache cleared successfully")
      } else {
        // Clear selected keys one by one as requested
        const results = await Promise.allSettled(
          keysToClear.map((key) => adminSystemService.clearCache(key))
        )

        const successCount = results.filter((r) => r.status === "fulfilled").length
        const failCount = results.filter((r) => r.status === "rejected").length

        if (failCount === 0) {
          toast.success(`Successfully cleared ${successCount} cache keys`)
        } else {
          toast.error(`Cleared ${successCount} keys, failed to clear ${failCount} keys`)
        }
      }
      onOpenChange(false)
    } catch (error: any) {
      const errorMessage = extractErrorMessage(error);

      toast.error(errorMessage || "Failed to clear cache")
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-muted-foreground/20 shadow-2xl rounded-2xl h-[600px]">
        <DialogHeader className="p-4 pb-2 border-b border-muted-foreground/10 bg-muted/30">
          <DialogTitle className="text-xl font-black tracking-tight text-foreground capitalize">Clear System Cache</DialogTitle>
          <DialogDescription className="text-sm">
            Select specific cache keys to clear or clear the entire system cache.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2 px-4 flex-1 overflow-hidden">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cache keys..."
              className="pl-9 h-10 rounded-xl bg-background/50 border-muted-foreground/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={filteredKeys.length > 0 && selectedKeys.size === filteredKeys.length}
                onCheckedChange={toggleSelectAll}
              />
              <Label htmlFor="select-all" className="text-xs font-medium cursor-pointer">
                Select All ({filteredKeys.length})
              </Label>
            </div>
            {selectedKeys.size > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedKeys.size} selected
              </span>
            )}
          </div>

          <ScrollArea className="flex-1 rounded-xl border border-muted-foreground/10 bg-muted/20 p-2 shadow-inner overflow-hidden">
            {isLoadingKeys ? (
              <div className="flex h-full  items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredKeys.length > 0 ? (
              <div className="flex flex-col gap-2 pb-8">
                {filteredKeys.map((key) => (
                  <div key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-background transition-colors ">
                    <Checkbox
                      id={`key-${key}`}
                      checked={selectedKeys.has(key)}
                      onCheckedChange={() => toggleKey(key)}
                      className="data-[state=checked]:bg-primary"
                    />
                    <Label
                      htmlFor={`key-${key}`}
                      className="text-sm font-medium break-all cursor-pointer flex-1"
                    >
                      {key}
                    </Label>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col h-full min-h-[300px] items-center justify-center text-center gap-2">
                <div className="p-4 rounded-full bg-muted/20">
                  <Search className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-foreground">
                    {searchQuery ? "No matching keys" : "No cache keys found"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {searchQuery ? "Try a different search term" : "The system cache is currently empty"}
                  </p>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="p-2 bg-muted/20 border-t border-muted-foreground/10">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isClearing}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleClear}
            isLoading={isClearing}
            className="rounded-xl  px-6 shadow-destructive/20"
          >
            {filteredKeys.length == selectedKeys.size ? "Clear Everything" : `Clear Selected (${selectedKeys.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
