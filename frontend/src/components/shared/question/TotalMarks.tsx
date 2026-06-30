type TotalMarksProps = {
    totalMarks: number;
}

export function TotalMarks({ totalMarks }: TotalMarksProps) {
    return <div className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1 rounded-lg border border-border/40">
        <span className="text-xs ">Total Marks:</span>
        <span className="text-xs font-bold">
            {totalMarks} Marks
        </span>
    </div>
}