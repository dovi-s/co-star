import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, GraduationCap, Building2, Users, Send, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackFeature } from "@/hooks/use-analytics";

interface ContactSalesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPlanType?: string;
}

const planTypes = [
  { id: "coach", label: "Coach / Director", icon: Users, description: "Manage students and assign scenes" },
  { id: "education", label: "School / Conservatory", icon: GraduationCap, description: "Bulk licensing and curriculum" },
  { id: "teams", label: "Theater Company", icon: Building2, description: "Cast-wide scripts and analytics" },
];

const teamSizeOptions = ["2-5", "6-15", "16-50", "51-100", "100+"];

export function ContactSalesSheet({ open, onOpenChange, defaultPlanType }: ContactSalesSheetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "");
  const [email, setEmail] = useState(user?.email || "");
  const [organization, setOrganization] = useState("");
  const [planType, setPlanType] = useState(defaultPlanType || "");
  const [teamSize, setTeamSize] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/contact-sales", { name, email, organization, planType, teamSize, message });
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      trackFeature("contact_sales", "submitted", { planType, teamSize });
      toast({ title: "Inquiry submitted!", description: "We'll be in touch within 24 hours." });
    },
    onError: (e: any) => toast({ title: "Failed to submit", description: e.message, variant: "destructive" }),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" data-testid="contact-sales-sheet">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative bg-background rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto border border-border/50 shadow-xl">
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm flex items-center justify-between p-4 border-b border-border/50">
          <h2 className="text-base font-semibold text-foreground">Get in touch</h2>
          <button onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground" data-testid="contact-sales-close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-green-500" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">Thank you!</h3>
            <p className="text-sm text-muted-foreground">Our team will reach out within 24 hours to discuss your needs.</p>
            <Button onClick={() => onOpenChange(false)} className="mt-4" data-testid="contact-sales-done">Done</Button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-foreground mb-2 block">What are you looking for?</label>
              <div className="space-y-2">
                {planTypes.map(pt => (
                  <button
                    key={pt.id}
                    onClick={() => setPlanType(pt.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left",
                      planType === pt.id
                        ? "border-primary/30 bg-primary/5"
                        : "border-border/50 hover:border-border"
                    )}
                    data-testid={`plan-type-${pt.id}`}
                  >
                    <pt.icon className={cn("w-4 h-4 shrink-0", planType === pt.id ? "text-primary" : "text-muted-foreground")} />
                    <div>
                      <span className={cn("text-sm font-medium", planType === pt.id ? "text-primary" : "text-foreground")}>{pt.label}</span>
                      <p className="text-[10px] text-muted-foreground">{pt.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Name</label>
                <Input value={name} onChange={e => setName(e.target.value)} className="h-9 text-sm" data-testid="sales-name" />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Email</label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-9 text-sm" data-testid="sales-email" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Organization</label>
              <Input value={organization} onChange={e => setOrganization(e.target.value)} placeholder="School, company, or studio name" className="h-9 text-sm" data-testid="sales-org" />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-2 block">Team size</label>
              <div className="flex flex-wrap gap-1.5">
                {teamSizeOptions.map(size => (
                  <button
                    key={size}
                    onClick={() => setTeamSize(teamSize === size ? "" : size)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                      teamSize === size
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "border-border/50 text-muted-foreground hover:text-foreground"
                    )}
                    data-testid={`team-size-${size}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Tell us more (optional)</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="What are your goals? Any specific requirements?"
                className="w-full h-20 px-3 py-2 rounded-md border border-border/50 bg-background text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                data-testid="sales-message"
              />
            </div>

            <Button
              onClick={() => submitMutation.mutate()}
              disabled={!name || !email || !planType || submitMutation.isPending}
              className="w-full h-10"
              data-testid="sales-submit"
            >
              {submitMutation.isPending ? "Sending..." : (
                <>
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  Submit inquiry
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
