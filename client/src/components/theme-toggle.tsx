import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      data-testid="button-theme-toggle"
      className="rounded-xl text-muted-foreground"
    >
      <div className="relative w-5 h-5">
        <Sun 
          className={cn(
            "h-5 w-5 absolute inset-0 transition-all duration-300",
            theme === "light" 
              ? "opacity-0 rotate-90 scale-0" 
              : "opacity-100 rotate-0 scale-100"
          )} 
        />
        <Moon 
          className={cn(
            "h-5 w-5 absolute inset-0 transition-all duration-300",
            theme === "light" 
              ? "opacity-100 rotate-0 scale-100" 
              : "opacity-0 -rotate-90 scale-0"
          )} 
        />
      </div>
    </Button>
  );
}
