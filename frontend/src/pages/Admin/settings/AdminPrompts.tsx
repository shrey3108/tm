/**
 * @module AdminPrompts
 * @component AdminPrompts
 *
 * Admin page for viewing AI prompts.
 * Displays all prompts used by the system with ability to view their content.
 */
import { useState, useEffect } from "react";
import type { PromptRead } from "@/types/admin";
import AppPageShell from "@/components/shared/AppPageShell";
import PageHeader from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import PermissionGuard from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { ArrowUpDown, Check, Clipboard, FileText, Info } from "lucide-react";
import { SearchableSelect } from "@/components/shared/SearchableSelect";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area"
import { useDebouncedValue } from "@/hooks/useDebounced";
import { usePrompts } from "@/hooks/queries/admin/usePrompts";
import { usePageFilters } from "@/hooks/usePageFilters";
import ErrorDisplay from "@/components/shared/ErrorDisplay";


export default function AdminPrompts() {
    const { filters, setFilters } = usePageFilters("adminPrompts", {
        pageIndex: 0,
        pageSize: 10,
        search: "",
        selectedStages: [] as string[],
    });
    const { pageIndex, pageSize, search, selectedStages } = filters;

    const setPagination = (val: PaginationState | ((prev: PaginationState) => PaginationState)) => {
        const currentPagination = { pageIndex: filters.pageIndex, pageSize: filters.pageSize };
        const nextPagination = typeof val === "function" ? val(currentPagination) : val;
        setFilters({
            pageIndex: nextPagination.pageIndex,
            pageSize: nextPagination.pageSize,
        });
    };

    const [selectedPrompt, setSelectedPrompt] = useState<PromptRead | null>(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [allStages, setAllStages] = useState<string[]>([]);
    const [isCopied, setIsCopied] = useState(false);
    const [overallTotal, setOverallTotal] = useState(0);

    const debouncedSearch = useDebouncedValue(search);

    const { data: prompts, loading, error, refetch, total } = usePrompts(pageIndex * pageSize, pageSize, debouncedSearch)


    const handleViewClick = (prompt: PromptRead) => {
        setSelectedPrompt(prompt);
        setIsViewModalOpen(true);
    };



    // Collect all unique stages from the response data over time
    useEffect(() => {
        if (prompts.length > 0) {
            const currentStages = prompts.flatMap(p => p.stage ? [p.stage] : []);
            const hasNewStages = currentStages.some(s => !allStages.includes(s));
            if (hasNewStages) {
                queueMicrotask(() => {
                    setAllStages(prev => {
                        const combined = Array.from(new Set([...prev, ...currentStages]));
                        return combined.sort();
                    });
                });
            }
        }
    }, [prompts, allStages]);


    useEffect(() => {
        if (!search && overallTotal !== total) {
            queueMicrotask(() => {
                setOverallTotal(total);
            });
        }
    }, [search, total, overallTotal]);

    const columns: ColumnDef<PromptRead>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="hover:bg-transparent p-0 font-semibold text-base"
                >
                    Prompt Name
                    <ArrowUpDown className="h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {row.original.name}
                </div>
            ),
        },
        {
            accessorKey: "content",
            header: () => {
                return (
                    <div className="flex items-center gap-2">
                        <span className="text-base">Content Preview</span>
                    </div>
                )
            },
            cell: ({ row }) => (
                <div className="max-w-87.5 truncate">
                    {row.original.content}
                </div>
            ),
        }, {
            id: "stages",
            header: () => {
                return (
                    <div className="flex items-center gap-2">
                        <span className="text-base">Stages</span>
                    </div>
                )
            },
            cell: ({ row }) => (
                <div className="max-w-125 truncate">
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
                                    className="h-9 w-9 p-0 rounded-xl hover:bg-gray-200/60 flex items-center justify-center shrink-0"
                                >
                                    <Info className="h-4 w-4 shrink-0" />
                                </Button>
                            )}
                        />
                        <HoverCardContent className="w-fit px-3 py-1.5 text-xs" side="top">
                            View Prompt
                        </HoverCardContent>
                    </HoverCard>
                </div>
            ),
        },
    ];

    // Handle search with pagination reset
    const handleSearchChange = (value: string) => {
        setFilters({
            search: value,
            pageIndex: 0,
        });
    };

    // Handle stage filter change with pagination reset
    const handleStageChange = (stages: string[]) => {
        setFilters({
            selectedStages: stages,
            pageIndex: 0,
        });
    };
    const handleCopy = async () => {
        if (!selectedPrompt?.content) return;
        await navigator.clipboard.writeText(selectedPrompt.content);
        setIsCopied(true);
        setTimeout(() => {
            setIsCopied(false);
        }, 2000);
    };

    const filteredPrompts = prompts.filter(
        (p) => selectedStages.length === 0 || selectedStages.includes(p.stage)
    );

    return (
        <AppPageShell width="wide">
            <PermissionGuard permissions={[PERMISSIONS.ANALYTICS_READ, PERMISSIONS.ADMIN_ACCESS]}>
                <PageHeader
                    title="AI Prompts"
                // subtitle="View the AI prompts used for candidate analysis and resume screening."
                />


                {error && !prompts.length ? (
                    <ErrorDisplay message={error.message} onRetry={refetch} />
                ) :
                    <DataTable
                        columns={columns}
                        data={filteredPrompts}
                        loading={loading}
                        isServerSide={true}
                        pageCount={Math.ceil(filteredPrompts.length / pageSize)}
                        pageSize={pageSize}
                        totalRecords={filteredPrompts.length}
                        totalCount={overallTotal}
                        resultCount={filteredPrompts.length}
                        onPaginationChange={setPagination}
                        onSearchChange={handleSearchChange}
                        entityName="Prompts"
                        searchValue={search}
                        searchKey="name"
                        searchPlaceholder="Filter prompts by name or content..."
                        tableActions={
                            <SearchableSelect
                                multiple
                                value={selectedStages}
                                onValueChange={handleStageChange}
                                options={allStages.map((s) => ({ id: s, label: s }))}
                                placeholder="Stages"
                                pluralLabel="Stages"
                                onClear={() => handleStageChange([])}
                                clearLabel="Clear selection"
                                triggerClassName={cn(
                                    "h-10 w-[150px] border text-xs font-medium select-none bg-background hover:bg-muted/50 hover:text-foreground",
                                    selectedStages.length > 0
                                        ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
                                        : "border-input text-muted-foreground"
                                )}
                            />
                        }
                    />}

                <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
                    <DialogContent className="flex w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col sm:w-[92vw] sm:max-w-[92vw] lg:max-w-250 max-h-[calc(100vh-1rem)] sm:max-h-[92vh] p-0 overflow-hidden rounded-[1.75rem] sm:rounded-3xl border-muted-foreground/10 bg-card/95 backdrop-blur-xl shadow-2xl h-162.5 gap-0.5">
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
