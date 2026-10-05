import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useCurrentUser, useUpdateProfile } from "@/hooks/useAuth";

export function ProfileForm() {
  const { data: user } = useCurrentUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const updateProfile = useUpdateProfile();

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate(
      { name, email },
      {
        onSuccess: () => toast.success("Profile updated"),
        onError: (error) =>
          toast.error(
            (error as { response?: { data?: { detail?: string } } } | null)
              ?.response?.data?.detail ?? "Could not update profile",
          ),
      },
    );
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-name">Name</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-email">Email</Label>
        <Input
          id="profile-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <Button
        type="submit"
        disabled={updateProfile.isPending}
        className="w-full sm:w-fit"
      >
        {updateProfile.isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
