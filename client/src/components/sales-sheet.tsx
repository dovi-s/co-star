import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { Send, Check, Mail, Building2, Users, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

interface SalesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const interestOptions = [
  { id: "teams", label: "Teams", icon: Users },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "enterprise", label: "Enterprise", icon: Building2 },
] as const;

type Interest = typeof interestOptions[number]["id"];

export function SalesSheet({ open, onOpenChange }: SalesSheetProps) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [interest, setInterest] = useState<Interest | "">("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    const parts = [message];
    if (organization.trim()) {
      parts.push(`\n--- Organization ---\n${organization}`);
    }
    if (interest) {
      parts.push(`\n--- Interest ---\n${interest}`);
    }
    if (name.trim()) {
      parts.push(`\n--- Name ---\n${name}`);
    }
    const fullMessage = parts.join("\n");

    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "sales",
        subject: interest ? `Sales inquiry (${interest})` : "Sales inquiry",
        message: fullMessage,
        contactEmail: email.trim() || user?.email || null,
        path: window.location.pathname,
      }),
      credentials: "include",
    }).catch(() => {});

    setSent(true);
    setTimeout(() => {
      setSent(false);
      setName("");
      setEmail("");
      setOrganization("");
      setInterest("");
      setMessage("");
      onOpenChange(false);
    }, 1500);
  };

  const handleClose = () => {
    setName("");
    setEmail("");
    setOrganization("");
    setInterest("");
    setMessage("");
    setSent(false);
    onOpenChange(false);
  };

  const canSend = (email.trim() || user?.email) && message.trim();

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-xl max-h-[85vh] flex flex-col">
        <SheetHeader className="text-left pb-2">
          <SheetTitle className="text-base font-semibold">Get in Touch</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Interested in team plans, education pricing, or a walkthrough? We would love to hear from you.
          </SheetDescription>
        </SheetHeader>

        {sent ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm text-foreground font-medium">Message sent</p>
            <p className="text-xs text-muted-foreground">We will get back to you soon.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                I am interested in
              </label>
              <div className="flex gap-2">
                {interestOptions.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setInterest(interest === opt.id ? "" : opt.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border",
                        interest === opt.id
                          ? "bg-primary/10 border-primary/30 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      )}
                      data-testid={`button-interest-${opt.id}`}
                    >
                      <Icon className="h-3 w-3" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <Textarea
              placeholder="Tell us about your needs, team size, or what you are looking for"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[80px] resize-none text-sm"
              data-testid="input-sales-message"
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Your name
                </label>
                <Input
                  placeholder={user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "Name"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-sm h-9"
                  data-testid="input-sales-name"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Organization
                </label>
                <Input
                  placeholder="School, company, etc."
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="text-sm h-9"
                  data-testid="input-sales-org"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Mail className="h-3 w-3" />
                Email
              </label>
              <Input
                type="email"
                placeholder={user?.email || "your@email.com"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-sm h-9"
                data-testid="input-sales-email"
              />
            </div>

            <Button
              onClick={handleSend}
              disabled={!canSend}
              className="w-full"
              data-testid="button-send-sales"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Send message
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
