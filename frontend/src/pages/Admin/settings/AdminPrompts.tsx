/**
 * Admin page for viewing AI prompts.
 * Displays all prompts used by the system with ability to view their content.
 */
import { useState, useEffect } from "react";
import { adminPromptService } from "@/apis/admin";
import type { PromptRead } from "@/types/admin";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Badge, Button } from "@/components";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuSeparator,
    DropdownMenuLabel,
    DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { ArrowUpDown, Check, Clipboard, FileText, Info, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAdminData, useDebouncedValue } from "@/hooks";
import { ErrorDisplay } from "@/components/shared";


const AdminPrompts = () => {
    const [search, setSearch] = useState("");
    const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });
    const [selectedPrompt, setSelectedPrompt] = useState<PromptRead | null>(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedStages, setSelectedStages] = useState<string[]>([]);
    const [allStages, setAllStages] = useState<string[]>([]);
    const debouncedSearch = useDebouncedValue(search)
    // Reset to first page when search changes
    useEffect(() => {
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, [debouncedSearch]);
    const { data: prompts, loading, error, fetchData, total } = useAdminData(() => adminPromptService.getAllPrompts(pageIndex * pageSize, pageSize, debouncedSearch), { fetchOnMount: false });

    // Collect all unique stages from the response data over time
    useEffect(() => {
        if (prompts.length > 0) {
            const currentStages = prompts.map(p => p.stage).filter(Boolean);
            setAllStages(prev => {
                const combined = Array.from(new Set([...prev, ...currentStages]));
                return combined.sort();
            });
        }
    }, [prompts]);
    const handleViewClick = (prompt: PromptRead) => {
        setSelectedPrompt(prompt);
        setIsViewModalOpen(true);
    };

    const [isCopied, setIsCopied] = useState(false);
    useEffect(() => {
        fetchData();
    }, [pageIndex, pageSize, debouncedSearch, fetchData]);
    const [overallTotal, setOverallTotal] = useState(0);
    useEffect(() => {
        if (!debouncedSearch) {
            setOverallTotal(total);
        }
    }, [total, debouncedSearch]);

    const columns: ColumnDef<PromptRead>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="hover:bg-transparent p-0 font-semibold"
                >
                    Prompt Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <div className="font-medium text-primary flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {row.original.name}
                </div>
            ),
        },
        {
            accessorKey: "content",
            header: () => {
                return (
                    <div className="flex items-center gap-2">
                        <span className="font-semibold">Content Preview</span>
                    </div>
                )
            },
            cell: ({ row }) => (
                <div className="max-w-[500px] truncate text-muted-foreground">
                    {row.original.content}
                </div>
            ),
        }, {
            id: "stages",
            header: () => {
                return (
                    <div className="flex items-center gap-2">
                        <span className="font-semibold">Stages</span>
                    </div>
                )
            },
            cell: ({ row }) => (
                <div className="max-w-[500px] truncate text-muted-foreground">
                    <Badge variant="outline" className="capitalize">
                        {row.original.stage}
                    </Badge>
                </div>
            )
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <HoverCard>
                        <HoverCardTrigger
                            render={(props) => (
                                <Button
                                    {...props}
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleViewClick(row.original)}
                                    className="h-9 w-9 p-0 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-center shrink-0"
                                >
                                    <Info className="h-4 w-4 shrink-0" />
                                </Button>
                            )}
                        />
                        <HoverCardContent side="top" className="w-auto p-2 min-w-0">
                            <div className="text-sm font-semibold">View Prompt</div>
                        </HoverCardContent>
                    </HoverCard>
                </div>
            ),
        },
    ];

    // Handle search with pagination reset
    const handleSearchChange = (value: string) => {
        setSearch(value);
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    };

    // Handle stage filter change with pagination reset
    const handleStageChange = (stages: string[]) => {
        setSelectedStages(stages);
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    };
    const handleCopy = async () => {
        if (!selectedPrompt?.content) return;
        await navigator.clipboard.writeText(selectedPrompt.content);
        setIsCopied(true);
        setTimeout(() => {
            setIsCopied(false);
        }, 2000);
    };

    return (
        <AppPageShell width="wide">
            <PermissionGuard permissions={[PERMISSIONS.ANALYTICS_READ, PERMISSIONS.ADMIN_ACCESS]}>
                <PageHeader
                    title="AI Prompts"
                // subtitle="View the AI prompts used for candidate analysis and resume screening."
                />


                {error && !prompts.length ? (
                    <ErrorDisplay message={error} onRetry={fetchData} />
                ) :
                    <DataTable
                        columns={columns}
                        data={prompts}
                        loading={loading}
                        isServerSide={true}
                        pageCount={Math.ceil(total / pageSize)}
                        pageSize={pageSize}
                        totalRecords={total}
                        totalCount={overallTotal}
                        resultCount={prompts.length}
                        onPaginationChange={setPagination}
                        onSearchChange={handleSearchChange}
                        entityName="Prompts"
                        searchValue={search}
                        searchKey="name"
                        searchPlaceholder="Filter prompts by name or content..."
                        tableActions={
                            <DropdownMenu>
                                <DropdownMenuTrigger
                                    className={cn(
                                        "inline-flex items-center justify-between gap-2 h-10 px-3 w-[150px] rounded-xl border text-xs font-medium cursor-pointer select-none transition-all",
                                        selectedStages.length > 0
                                            ? "border-primary/30 bg-primary/5 text-primary"
                                            : "border-input bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                    )}
                                >
                                    <span className="truncate">
                                        {selectedStages.length === 0
                                            ? "Stages"
                                            : selectedStages.length === 1
                                                ? selectedStages[0]
                                                : `${selectedStages.length} Stages`}
                                    </span>
                                    <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="min-w-[180px] rounded-xl shadow-lg p-1">
                                    <DropdownMenuGroup>
                                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5">Stages</DropdownMenuLabel>
                                        {allStages.length === 0 ? (
                                            <div className="px-2 py-4 text-xs text-center text-muted-foreground">
                                                No stages found
                                            </div>
                                        ) : (
                                            <div className="max-h-[240px] overflow-y-auto custom-scrollbar">
                                                {allStages.map((s) => (
                                                    <DropdownMenuCheckboxItem
                                                        key={s}
                                                        checked={selectedStages.includes(s)}
                                                        onSelect={(e) => e.preventDefault()}
                                                        onClick={() =>
                                                            handleStageChange(
                                                                selectedStages.includes(s)
                                                                    ? selectedStages.filter((v) => v !== s)
                                                                    : [...selectedStages, s]
                                                            )
                                                        }
                                                        className="rounded-lg capitalize"
                                                    >
                                                        {s}
                                                    </DropdownMenuCheckboxItem>
                                                ))}
                                            </div>
                                        )}
                                        {selectedStages.length > 0 && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuCheckboxItem
                                                    checked={false}
                                                    onClick={() => handleStageChange([])}
                                                    className="text-destructive focus:text-destructive focus:bg-destructive/10 rounded-lg"
                                                >
                                                    Clear selection
                                                </DropdownMenuCheckboxItem>
                                            </>
                                        )}
                                    </DropdownMenuGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        }
                    />}

                <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                    <DialogContent className="flex w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col sm:w-[92vw] sm:max-w-[92vw] lg:max-w-250 max-h-[calc(100vh-1rem)] sm:max-h-[92vh] p-0 overflow-hidden rounded-[1.75rem] sm:rounded-3xl border-muted-foreground/10 bg-card/95 backdrop-blur-xl shadow-2xl h-[650px] gap-0.5">
                        <div className="px-4 py-2 ">
                            <DialogHeader className="mb-2">
                                <DialogTitle className="flex items-center gap-2 text-xl">
                                    <FileText className="h-5 w-5 text-primary" />
                                    {selectedPrompt?.name}
                                </DialogTitle>
                                <DialogDescription className="mt-0">
                                    Full content of the AI prompt used by the system.
                                </DialogDescription>

                            </DialogHeader>
                        </div>

                        <ScrollArea className="flex-1 min-h-0 w-full border-y bg-muted/5">
                            <div className="p-1">
                                <Button className="float-right m-1 sticky top-2 bg-background border-none " size={"icon"} variant={"ghost"}
                                    onClick={handleCopy}
                                >
                                    {isCopied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                                </Button>
                                <pre className="p-4 bg-muted/50 rounded-xl font-mono text-sm whitespace-pre-wrap border border-muted-foreground/10 leading-relaxed">
                                    {selectedPrompt?.content.trim()}
                                </pre>
                            </div>
                        </ScrollArea>
                    </DialogContent>
                </Dialog>
            </PermissionGuard>
        </AppPageShell >
    );
};

export default AdminPrompts;
