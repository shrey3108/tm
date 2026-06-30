type TotalSelectedQuestionsProps = {
    totalQuestions: number;
}

export function TotalSelectedQuestions({ totalQuestions }: TotalSelectedQuestionsProps) {
    return <div className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1 rounded-lg border border-border/40">
        <span className="text-xs text-muted-foreground font-medium">Selected Items:</span>
        <span className="text-xs font-bold text-foreground">
            {totalQuestions}
        </span>
    </div>
}