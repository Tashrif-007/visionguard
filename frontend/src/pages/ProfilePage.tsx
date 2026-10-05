import { CalendarDays, Mail, ShieldCheck } from "lucide-react";
import { ProfileForm } from "@/components/ProfileForm";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentUser } from "@/hooks/useAuth";

export function ProfilePage() {
  const { data: user } = useCurrentUser();

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 text-center">
            {user ? (
              <>
                <span className="flex h-20 w-20 items-center justify-center rounded-full border border-border bg-secondary font-mono text-2xl font-semibold uppercase">
                  {user.name.slice(0, 2)}
                </span>
                <div className="flex flex-col items-center gap-1">
                  <h1 className="text-lg font-semibold leading-tight">
                    {user.name}
                  </h1>
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    {user.email}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    <ShieldCheck className="h-3 w-3" />
                    {user.role}
                  </Badge>
                  <Badge variant="outline">
                    <CalendarDays className="h-3 w-3" />
                    Member since{" "}
                    {new Date(user.created_at).toLocaleDateString(undefined, {
                      dateStyle: "medium",
                    })}
                  </Badge>
                </div>
              </>
            ) : (
              <Skeleton className="h-40 w-full" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Tabs defaultValue="details" className="gap-5">
              <TabsList className="w-full">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
              </TabsList>
              <TabsContent value="details">
                <p className="mb-4 text-sm text-muted-foreground">
                  Your name and email — email is also what you sign in with.
                </p>
                <ProfileForm />
              </TabsContent>
              <TabsContent value="security">
                <p className="mb-4 text-sm text-muted-foreground">
                  Update the password for your own account.
                </p>
                <ChangePasswordForm />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
