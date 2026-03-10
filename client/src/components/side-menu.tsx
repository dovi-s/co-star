import { useRef, useState, useCallback } from "react";
import { trackClick, trackNavigation } from "@/hooks/use-analytics";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { useTheme } from "@/lib/theme-provider";
import { useProfile } from "@/context/profile-context";
import { useAuth } from "@/hooks/use-auth";
import { ProfileAvatar } from "@/components/profile-avatar";
import {
  CircleUser,
  LogIn,
  Library,
  CreditCard,
  Sparkles,
  Scale,
  Map,
  MessageCircle,
  Share2,
  Moon,
  Sun,
  ChevronRight,
  Crown,
  Camera,
  BarChart3,
  Lightbulb,
  Palette,
  Users,
  Handshake,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { FeedbackSheet } from "@/components/feedback-sheet";
import { SalesSheet } from "@/components/sales-sheet";

interface SideMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: (page: string) => void;
  activePage?: string;
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick?: () => void;
  badge?: string;
  disabled?: boolean;
  testId?: string;
  active?: boolean;
}

function MenuItem({ icon, label, description, onClick, badge, disabled, testId, active }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
        disabled && "opacity-40 cursor-default",
        active && "bg-primary/[0.08] dark:bg-primary/[0.12]"
      )}
      data-testid={testId}
    >
      <span className={cn("shrink-0", active ? "text-primary" : "text-muted-foreground")}>{icon}</span>
      <div className="flex-1 min-w-0">
        <span className={cn("text-sm font-medium block", active ? "text-primary" : "text-foreground")}>{label}</span>
        {description && (
          <span className="text-[11px] text-muted-foreground block mt-0.5">{description}</span>
        )}
      </div>
      {badge && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary shrink-0">
          {badge}
        </span>
      )}
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-3 pt-4 pb-1.5">
      {children}
    </p>
  );
}

function resizeImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxSize) { h = (h * maxSize) / w; w = maxSize; }
        } else {
          if (h > maxSize) { w = (w * maxSize) / h; h = maxSize; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function SideMenu({ open, onOpenChange, onNavigate, activePage }: SideMenuProps) {
  const { theme, toggleTheme } = useTheme();
  const { profile, setPhoto } = useProfile();
  const { user, isAuthenticated: isSignedIn, logout } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);

  const navigate = (page: string) => {
    trackClick(`menu-${page}`);
    trackNavigation("menu", page);
    onOpenChange(false);
    onNavigate?.(page);
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file, 256);
      setPhoto(dataUrl);
    } catch {}
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[300px] sm:max-w-[340px] p-0 flex flex-col overflow-hidden">
        <SheetHeader className="px-5 pt-5 pb-3 text-left">
          <div className="flex items-center gap-3">
            <Logo size="xs" onClick={() => navigate("home")} />
            <div>
              <SheetTitle className="text-base">
                <span className="font-normal">Co-star</span>{" "}
                <span className="font-semibold">Studio</span>
              </SheetTitle>
              <SheetDescription className="text-[11px] text-muted-foreground mt-0">
                Your rehearsal companion
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoSelect}
          data-testid="input-profile-photo"
        />

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {!isSignedIn ? (
            <div className="mx-3 mb-2 p-4 rounded-md glass-surface">
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                Create an account to save scripts, remove the watermark, and track your progress.
              </p>
              <Button
                className="w-full"
                size="sm"
                onClick={() => navigate("signin")}
                data-testid="button-menu-signin"
              >
                <LogIn className="h-3.5 w-3.5 mr-1.5" />
                Get started
              </Button>
            </div>
          ) : (
            <div className="mx-3 mb-2 p-3 rounded-md glass-surface">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="relative shrink-0"
                  data-testid="button-change-photo"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                    <ProfileAvatar size="lg" className="text-primary" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <Camera className="h-2 w-2 text-primary-foreground" />
                  </div>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {user?.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}` : profile.name || "Actor"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{user?.email || ""}</p>
                </div>
                <span className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded-sm",
                  user?.subscriptionTier === "pro"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted-foreground/10 text-muted-foreground"
                )}>
                  {user?.subscriptionTier === "pro" ? "Pro" : "Free"}
                </span>
              </div>
            </div>
          )}

          <SectionLabel>Rehearse</SectionLabel>
          <MenuItem
            icon={<Home className="h-4 w-4" />}
            label="Home"
            description="Start rehearsing"
            onClick={() => navigate("home")}
            active={activePage === "home"}
            testId="menu-item-home"
          />
          <MenuItem
            icon={<Library className="h-4 w-4" />}
            label="Saved Scripts"
            description={isSignedIn ? "Your script collection" : "Sign in to save scripts"}
            onClick={() => navigate("library")}
            disabled={!isSignedIn}
            active={activePage === "library"}
            testId="menu-item-library"
          />
          <MenuItem
            icon={<BarChart3 className="h-4 w-4" />}
            label="Performance History"
            description={isSignedIn ? "Track your accuracy over time" : "Sign in to track progress"}
            onClick={() => navigate("history")}
            disabled={!isSignedIn}
            active={activePage === "history"}
            testId="menu-item-history"
          />

          {isSignedIn && (
            <>
              <SectionLabel>Account</SectionLabel>
              <MenuItem
                icon={<CircleUser className="h-4 w-4" />}
                label="Actor Profile"
                description="Your details and headshot"
                onClick={() => navigate("profile")}
                active={activePage === "profile"}
                testId="menu-item-profile"
              />
              <MenuItem
                icon={<CreditCard className="h-4 w-4" />}
                label="Subscription"
                description="Manage your plan and billing"
                onClick={() => navigate("subscription")}
                active={activePage === "subscription"}
                testId="menu-item-billing"
              />
              {user?.email === "dovisherman@gmail.com" && (
                <MenuItem
                  icon={<BarChart3 className="h-4 w-4" />}
                  label="Analytics"
                  description="Growth metrics and insights"
                  onClick={() => navigate("admin")}
                  active={activePage === "admin"}
                  testId="menu-item-admin"
                />
              )}
            </>
          )}

          <SectionLabel>About</SectionLabel>
          <MenuItem
            icon={<Sparkles className="h-4 w-4" />}
            label="How It Works"
            description="See Co-star Studio in action"
            onClick={() => navigate("how-it-works")}
            active={activePage === "how-it-works"}
            testId="menu-item-how-it-works"
          />
          <MenuItem
            icon={<Scale className="h-4 w-4" />}
            label="Compare and Pricing"
            description="See how we stack up"
            onClick={() => navigate("compare")}
            active={activePage === "compare"}
            testId="menu-item-compare"
          />
          <MenuItem
            icon={<Map className="h-4 w-4" />}
            label="Roadmap"
            description="What we are building next"
            onClick={() => navigate("roadmap")}
            active={activePage === "roadmap"}
            testId="menu-item-roadmap"
          />
          <MenuItem
            icon={<Lightbulb className="h-4 w-4" />}
            label="Feature Board"
            description="Vote on what we build next"
            onClick={() => navigate("feature-board")}
            active={activePage === "feature-board"}
            testId="menu-item-feature-board"
          />

          <Separator className="my-2 mx-3" />

          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">
                {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </span>
              <span className="text-sm font-medium text-foreground">
                {theme === "dark" ? "Dark mode" : "Light mode"}
              </span>
            </div>
            <button
              onClick={toggleTheme}
              className={cn(
                "relative w-10 h-[22px] rounded-full transition-colors duration-200",
                theme === "dark" ? "bg-primary" : "bg-muted-foreground/20"
              )}
              data-testid="menu-theme-toggle"
            >
              <span
                className={cn(
                  "absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                  theme === "dark" ? "translate-x-[22px]" : "translate-x-[3px]"
                )}
              />
            </button>
          </div>

          <Separator className="my-2 mx-3" />

          <SectionLabel>Support & Share</SectionLabel>
          <MenuItem
            icon={<MessageCircle className="h-4 w-4" />}
            label="Support"
            description="Report a bug or issue"
            onClick={() => setFeedbackOpen(true)}
            testId="menu-item-support"
          />
          <MenuItem
            icon={<Handshake className="h-4 w-4" />}
            label="Sales"
            description="Teams, education, or demo"
            onClick={() => setSalesOpen(true)}
            testId="menu-item-sales"
          />
          <MenuItem
            icon={<Share2 className="h-4 w-4" />}
            label="Tell a Friend"
            description="Share with fellow actors"
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: "Co-star Studio",
                  text: "Check out Co-star Studio, your on demand scene partner",
                  url: window.location.origin,
                }).catch(() => {});
              } else {
                navigator.clipboard.writeText(window.location.origin).then(() => {
                  toast({ description: "Link copied to clipboard" });
                }).catch(() => {});
              }
            }}
            testId="menu-item-share"
          />

          {isSignedIn && (
            <>
              <Separator className="my-2 mx-3" />
              <button
                onClick={() => { onOpenChange(false); logout(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left text-sm text-muted-foreground"
                data-testid="menu-item-logout"
              >
                <LogIn className="h-4 w-4 rotate-180" />
                Log out
              </button>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border/40">
          <div className="flex items-center justify-center gap-3 flex-wrap text-[11px] text-muted-foreground">
            <button onClick={() => navigate("who-is-it-for")} data-testid="link-who-is-it-for">
              Who Is It For
            </button>
            <span>·</span>
            <button onClick={() => navigate("brand")} data-testid="link-brand">
              Brand
            </button>
            <span>·</span>
            <button onClick={() => navigate("terms")} data-testid="link-terms">
              Terms
            </button>
            <span>·</span>
            <button onClick={() => navigate("privacy")} data-testid="link-privacy">
              Privacy
            </button>
            <span>·</span>
            <span>v1.0</span>
          </div>
        </div>
      </SheetContent>
      <FeedbackSheet open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <SalesSheet open={salesOpen} onOpenChange={setSalesOpen} />
    </Sheet>
  );
}
