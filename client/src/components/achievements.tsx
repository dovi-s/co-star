import { Trophy, Flame, Star, Zap, Target, Award, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: "streak_3",
    name: "Consistent",
    description: "3 day streak",
    icon: <Flame className="h-5 w-5" />,
    color: "from-orange-400 to-red-500",
  },
  {
    id: "streak_7",
    name: "Dedicated",
    description: "7 day streak",
    icon: <Flame className="h-5 w-5" />,
    color: "from-orange-500 to-red-600",
  },
  {
    id: "streak_30",
    name: "Unstoppable",
    description: "30 day streak",
    icon: <Crown className="h-5 w-5" />,
    color: "from-yellow-400 to-orange-500",
  },
  {
    id: "lines_100",
    name: "Getting Started",
    description: "100 lines rehearsed",
    icon: <Star className="h-5 w-5" />,
    color: "from-blue-400 to-blue-600",
  },
  {
    id: "lines_1000",
    name: "Line Master",
    description: "1,000 lines rehearsed",
    icon: <Award className="h-5 w-5" />,
    color: "from-purple-400 to-purple-600",
  },
  {
    id: "runs_10",
    name: "Scene Pro",
    description: "10 scene runs",
    icon: <Target className="h-5 w-5" />,
    color: "from-green-400 to-green-600",
  },
];

interface AchievementsDisplayProps {
  unlockedIds: string[];
  showLocked?: boolean;
}

export function AchievementsDisplay({ unlockedIds, showLocked = true }: AchievementsDisplayProps) {
  const unlockedAchievements = ACHIEVEMENTS.filter(a => unlockedIds.includes(a.id));
  const lockedAchievements = ACHIEVEMENTS.filter(a => !unlockedIds.includes(a.id));

  return (
    <div className="space-y-4">
      {unlockedAchievements.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Unlocked</h3>
          <div className="grid grid-cols-3 gap-2">
            {unlockedAchievements.map((achievement) => (
              <AchievementBadge key={achievement.id} achievement={achievement} unlocked />
            ))}
          </div>
        </div>
      )}
      
      {showLocked && lockedAchievements.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Keep Going</h3>
          <div className="grid grid-cols-3 gap-2">
            {lockedAchievements.map((achievement) => (
              <AchievementBadge key={achievement.id} achievement={achievement} unlocked={false} />
            ))}
          </div>
        </div>
      )}
      
      {unlockedAchievements.length === 0 && !showLocked && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Start rehearsing to unlock achievements!
        </p>
      )}
    </div>
  );
}

function AchievementBadge({ achievement, unlocked }: { achievement: Achievement; unlocked: boolean }) {
  return (
    <div 
      className={cn(
        "flex flex-col items-center p-3 rounded-xl text-center transition-all",
        unlocked 
          ? "bg-card border shadow-sm" 
          : "bg-muted/30 opacity-50"
      )}
    >
      <div 
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center mb-2",
          unlocked 
            ? `bg-gradient-to-br ${achievement.color} text-white shadow-md` 
            : "bg-muted text-muted-foreground"
        )}
      >
        {achievement.icon}
      </div>
      <p className="text-xs font-medium truncate w-full">{achievement.name}</p>
      <p className="text-[10px] text-muted-foreground truncate w-full">{achievement.description}</p>
    </div>
  );
}

export function AchievementPopup({ achievementId, onClose }: { achievementId: string; onClose: () => void }) {
  const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
  if (!achievement) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="bg-card border shadow-2xl rounded-3xl p-8 text-center celebrate max-w-sm mx-4">
        <div 
          className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4",
            `bg-gradient-to-br ${achievement.color} text-white shadow-lg heartbeat`
          )}
        >
          <Trophy className="h-10 w-10" />
        </div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Achievement Unlocked!</p>
        <h3 className="text-2xl font-bold mb-2">{achievement.name}</h3>
        <p className="text-muted-foreground">{achievement.description}</p>
      </div>
    </div>
  );
}
