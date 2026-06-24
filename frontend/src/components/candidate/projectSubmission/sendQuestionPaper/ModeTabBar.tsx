import { cn } from "@/lib/utils";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Sparkles,
  Edit,
  Shuffle,
  PlusCircle,
  Layers,
  Wand2,
  Lock,
} from "lucide-react";

export type AssignmentMode =
  | "auto"
  | "custom"
  | "random_extra"
  | "custom_extra"
  | "random_custom"
  | "full_mix";

interface TabConfig {
  id: AssignmentMode;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabConfig[] = [
  {
    id: "auto",
    label: "Auto Assign",
    description: "Re-use previously assigned paper / send existing email",
    icon: Sparkles,
  },
  {
    id: "custom",
    label: "Custom",
    description: "Pure custom question & MCQ selection",
    icon: Edit,
  },
  {
    id: "random_extra",
    label: "Random+",
    description: "Random questions selection plus extra questions",
    icon: Shuffle,
  },
  {
    id: "custom_extra",
    label: "Custom+",
    description: "Custom selection plus extra questions",
    icon: PlusCircle,
  },
  {
    id: "random_custom",
    label: "Random & Custom",
    description: "Random questions questions blended with custom selections",
    icon: Layers,
  },
  {
    id: "full_mix",
    label: "Full Mix",
    description: "Combine random questions, custom selections, and extra questions, MCQs, and tasks",
    icon: Wand2,
  },
];

interface ModeTabBarProps {
  mode: AssignmentMode;
  onModeChange: (mode: AssignmentMode) => void;
  disabledModes: AssignmentMode[];
  disabledReasons?: Record<AssignmentMode, string>;
}

export function ModeTabBar({
  mode,
  onModeChange,
  disabledModes,
  disabledReasons = {} as Record<AssignmentMode, string>,
}: ModeTabBarProps) {
  return (
    <div className="w-full border-b border-border/40 bg-muted/10 px-4 py-2 shrink-0 overflow-x-auto no-scrollbar scroll-smooth">
      <div className="flex gap-2 min-w-max pb-1">
        {TABS.map((tab) => {
          const isActive = mode === tab.id;
          const isDisabled = disabledModes.includes(tab.id);
          const Icon = tab.icon;

          const buttonContent = (
            <button
              key={tab.id}
              type="button"
              disabled={isDisabled}
              onClick={() => !isDisabled && onModeChange(tab.id)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-300 border",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 border-primary scale-[1.02]"
                  : "bg-background hover:bg-muted/80 text-muted-foreground border-border/50 hover:text-foreground",
                isDisabled && "opacity-40 cursor-not-allowed hover:bg-background hover:text-muted-foreground scale-100 border-border/20"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", isActive ? "animate-pulse" : "")} />
              <span>{tab.label}</span>
              {isDisabled && <Lock className="h-3 w-3 shrink-0 opacity-60 ml-0.5" />}
            </button>
          );

          if (isDisabled && disabledReasons[tab.id]) {
            return (
              <HoverCard key={tab.id}>
                <HoverCardTrigger delay={150} closeDelay={150}>{buttonContent}</HoverCardTrigger>
                <HoverCardContent side="bottom" className="max-w-xs p-2 text-xs">
                  {disabledReasons[tab.id]}
                </HoverCardContent>
              </HoverCard>
            );
          }

          return (
            <HoverCard key={tab.id}  >
              <HoverCardTrigger delay={150} closeDelay={150}>{buttonContent}</HoverCardTrigger>
              <HoverCardContent side="bottom" className="max-w-xs p-2 text-xs">
                {tab.description}
              </HoverCardContent>
            </HoverCard>
          );
        })}
      </div>
    </div>
  );
}
