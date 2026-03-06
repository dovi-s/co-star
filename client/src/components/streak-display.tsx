import { Flame, Target, Trophy, Star } from "lucide-react";
import { Mascot, MascotName } from "@/components/mascot";
import { cn } from "@/lib/utils";

interface StreakDisplayProps {
  streak: number;
  dailyGoal: number;
  todayLines: number;
  compact?: boolean;
}

export function StreakDisplay({ streak, dailyGoal, todayLines, compact = false }: StreakDisplayProps) {
  const goalProgress = Math.min((todayLines / dailyGoal) * 100, 100);
  const goalComplete = todayLines >= dailyGoal;
  
  if (compact) {
    return (
      <div className="flex items-center gap-3" data-testid="streak-display-compact">
        <div className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold",
          streak > 0 ? "bg-orange-500/15 text-orange-600" : "bg-muted text-muted-foreground"
        )}>
          <Flame className={cn("h-3.5 w-3.5", streak > 0 && "animate-pulse")} />
          <span>{streak}</span>
        </div>
        
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-500",
                goalComplete ? "bg-green-500" : "bg-primary"
              )}
              style={{ width: `${goalProgress}%` }}
            />
          </div>
          <span className="text-[11px] text-muted-foreground">
            {todayLines}/{dailyGoal}
          </span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-card border rounded-2xl p-4 space-y-4" data-testid="streak-display-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            streak > 0 
              ? "bg-gradient-to-br from-orange-400 to-red-500 text-white" 
              : "bg-muted text-muted-foreground"
          )}>
            <Flame className={cn("h-6 w-6", streak > 0 && "animate-pulse")} />
          </div>
          <div>
            <p className="text-2xl font-bold">{streak}</p>
            <p className="text-xs text-muted-foreground">day streak</p>
          </div>
        </div>
        
        {streak >= 7 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/15 rounded-full">
            <Trophy className="h-3.5 w-3.5 text-yellow-600" />
            <span className="text-xs font-medium text-yellow-600">On fire!</span>
          </div>
        )}
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5">
            <Target className="h-4 w-4 text-primary" />
            <span className="font-medium">Daily Goal</span>
          </div>
          <span className={cn(
            "font-bold",
            goalComplete ? "text-green-500" : "text-foreground"
          )}>
            {todayLines} / {dailyGoal} lines
          </span>
        </div>
        
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              goalComplete 
                ? "bg-gradient-to-r from-green-400 to-green-500" 
                : "bg-gradient-to-r from-primary to-primary/80"
            )}
            style={{ width: `${goalProgress}%` }}
          />
        </div>
        
        {goalComplete && (
          <div className="flex items-center justify-center gap-2 pt-2 text-green-600">
            <Star className="h-4 w-4 fill-current" />
            <span className="text-sm font-medium">Goal complete! <MascotName /> is proud!</span>
          </div>
        )}
      </div>
    </div>
  );
}
