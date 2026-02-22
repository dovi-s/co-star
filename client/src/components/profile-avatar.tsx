import { CircleUser } from "lucide-react";
import { useProfile } from "@/context/profile-context";
import { cn } from "@/lib/utils";

interface ProfileAvatarProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "w-5 h-5",
  md: "w-8 h-8",
  lg: "w-10 h-10",
};

const iconSizeMap = {
  sm: "h-5 w-5",
  md: "h-8 w-8",
  lg: "h-10 w-10",
};

export function ProfileAvatar({ size = "sm", className }: ProfileAvatarProps) {
  const { profile } = useProfile();

  if (profile.photoUrl) {
    return (
      <img
        src={profile.photoUrl}
        alt="Profile"
        className={cn(sizeMap[size], "rounded-full object-cover", className)}
        data-testid="img-profile-avatar"
      />
    );
  }

  return (
    <CircleUser
      className={cn(iconSizeMap[size], className)}
      data-testid="icon-profile-avatar"
    />
  );
}
