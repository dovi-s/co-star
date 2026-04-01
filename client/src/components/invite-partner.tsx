import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Copy, Check, Share2, Send, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackFeature } from "@/hooks/use-analytics";

interface InviteData {
  inviteCode: string;
  inviteUrl: string;
  sentCount: number;
  acceptedCount: number;
}

export function InvitePartnerCard({ scriptName, roleName, className }: { scriptName?: string; roleName?: string; className?: string }) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [showEmail, setShowEmail] = useState(false);

  const { data: invite, isLoading } = useQuery<InviteData>({
    queryKey: ["/api/invite-code"],
    enabled: isAuthenticated,
    retry: 2,
  });

  const sendInvite = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/invites/send", {
        recipientEmail: email || undefined,
        scriptName,
        roleName,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invite sent!" });
      trackFeature("invite_partner", "sent", { scriptName, roleName });
      setEmail("");
      setShowEmail(false);
      queryClient.invalidateQueries({ queryKey: ["/api/invite-code"] });
    },
  });

  const handleCopy = async () => {
    if (!invite?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(invite.inviteUrl);
      setCopied(true);
      trackFeature("invite_partner", "copied_link");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't copy link", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    if (!invite?.inviteUrl) return;
    trackFeature("invite_partner", "shared");
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on Co-star Studio",
          text: scriptName
            ? `I'm rehearsing "${scriptName}" on Co-star Studio. Join me!`
            : "Check out Co-star Studio — the best way to rehearse scripts!",
          url: invite.inviteUrl,
        });
      } catch {}
    } else {
      handleCopy();
    }
  };

  if (!isAuthenticated) return null;

  const ready = !!invite?.inviteUrl;

  return (
    <div className={cn("rounded-lg border border-primary/15 bg-primary/[0.03] p-3", className)} data-testid="invite-partner-card">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
          <Users className="w-3.5 h-3.5 text-primary" />
        </div>
        <div>
          <h4 className="text-sm font-medium text-foreground">Invite a scene partner</h4>
          <p className="text-[10px] text-muted-foreground">Rehearse together — it's better with a partner</p>
        </div>
      </div>

      <div className="flex gap-1.5 mb-2">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={handleShare} disabled={!ready} data-testid="invite-share-btn">
          <Share2 className="w-3 h-3 mr-1" />
          {isLoading ? "Loading..." : "Share"}
        </Button>
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={handleCopy} disabled={!ready} data-testid="invite-copy-btn">
          {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
          {copied ? "Copied!" : "Copy link"}
        </Button>
      </div>

      {showEmail ? (
        <div className="flex gap-1.5">
          <Input
            type="email"
            placeholder="partner@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="h-8 text-xs"
            data-testid="invite-email-input"
          />
          <Button size="sm" className="h-8 px-2" onClick={() => sendInvite.mutate()} disabled={!email || sendInvite.isPending} data-testid="invite-send-btn">
            <Send className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <button onClick={() => setShowEmail(true)} className="text-[11px] text-primary hover:underline" data-testid="invite-email-toggle">
          Or send via email
        </button>
      )}

      {invite && (invite.sentCount > 0 || invite.acceptedCount > 0) && (
        <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
          <span>{invite.sentCount} sent</span>
          <span>{invite.acceptedCount} joined</span>
        </div>
      )}
    </div>
  );
}

export function InvitePartnerInline({ scriptName, className }: { scriptName?: string; className?: string }) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const { data: invite, isLoading, isError } = useQuery<InviteData>({
    queryKey: ["/api/invite-code"],
    enabled: isAuthenticated,
    retry: 2,
  });

  const handleShare = async () => {
    if (!invite?.inviteUrl) return;
    trackFeature("invite_partner", "inline_shared");
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on Co-star Studio",
          text: scriptName
            ? `I'm rehearsing "${scriptName}". Join me on Co-star Studio!`
            : "Check out Co-star Studio!",
          url: invite.inviteUrl,
        });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(invite.inviteUrl);
      setCopied(true);
      toast({ title: "Invite link copied!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't share invite", variant: "destructive" });
    }
  };

  if (!isAuthenticated) return null;

  const ready = !!invite?.inviteUrl;

  return (
    <button
      onClick={handleShare}
      disabled={!ready}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
        ready
          ? "text-primary bg-primary/5 hover:bg-primary/10"
          : "text-muted-foreground bg-muted/30 cursor-not-allowed",
        className
      )}
      data-testid="invite-partner-inline"
    >
      {copied ? <Check className="w-3 h-3" /> : <Gift className="w-3 h-3" />}
      {isLoading ? "Loading..." : copied ? "Link copied!" : "Invite a scene partner"}
    </button>
  );
}
