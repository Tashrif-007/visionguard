import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Lock, Search, Trash2, UserCheck, UserX } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateOperatorForm } from "@/components/CreateOperatorForm";
import { EventListItem } from "@/components/EventListItem";
import { useCurrentUser, useSetUserStatus, useUsers } from "@/hooks/useAuth";
import { useDeleteEvent, useEvents } from "@/hooks/useEvents";
import type { User } from "@/types";

function errorDetail(error: unknown): string | undefined {
  return (error as { response?: { data?: { detail?: string } } } | null)
    ?.response?.data?.detail;
}

function AccountsTab() {
  const [search, setSearch] = useState("");
  const { data: me } = useCurrentUser();
  const { data: users, isLoading } = useUsers();
  const setUserStatus = useSetUserStatus();

  const filtered = useMemo(
    () =>
      (users ?? []).filter((u) => {
        const q = search.trim().toLowerCase();
        return (
          u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
        );
      }),
    [users, search],
  );

  const toggleStatus = (user: User) =>
    setUserStatus.mutate(
      { userId: user.id, isActive: !user.is_active },
      {
        onSuccess: () =>
          toast.success(
            user.is_active ? "Account deactivated" : "Account activated",
          ),
        onError: (error) =>
          toast.error(errorDetail(error) ?? "Could not update account"),
      },
    );

  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
      <div className="lg:col-span-5">
        <CreateOperatorForm />
      </div>

      <Card className="lg:col-span-7">
        <CardHeader>
          <CardTitle>User accounts</CardTitle>
          <CardDescription>
            {users?.length ?? 0} account{users?.length === 1 ? "" : "s"} —
            deactivating blocks sign-in without deleting the account
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email"
              className="h-8 pl-8 font-mono text-xs"
            />
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading accounts…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No accounts match &ldquo;{search}&rdquo;
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Personnel</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => {
                  const isSelf = user.id === me?.id;
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="font-medium">{user.name}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? "success" : "muted"}>
                          {user.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {/* users.created_at is a server-local naive timestamp, so it is read as local time */}
                        {new Date(user.created_at).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "medium",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        {isSelf ? (
                          <span
                            className="label-mono inline-flex items-center gap-1.5 text-muted-foreground"
                            title="You can't deactivate your own account"
                          >
                            <Lock className="h-3 w-3" />
                            Self / Protected
                          </span>
                        ) : user.is_active ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={setUserStatus.isPending}
                              >
                                <UserX className="h-3.5 w-3.5" />
                                Deactivate
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Deactivate {user.name}?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  They won't be able to sign in until
                                  reactivated. This doesn't delete the account.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => toggleStatus(user)}
                                >
                                  Deactivate
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            disabled={setUserStatus.isPending}
                            onClick={() => toggleStatus(user)}
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            Activate
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EventsTab() {
  const { data, isLoading } = useEvents({ limit: 200 });
  const deleteEvent = useDeleteEvent();
  const events = data?.events ?? [];

  const handleDelete = (eventId: number) =>
    deleteEvent.mutate(eventId, {
      onSuccess: () => toast.success("Event deleted"),
      onError: (error) =>
        toast.error(errorDetail(error) ?? "Could not delete event"),
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>All events</CardTitle>
        <CardDescription>
          {data?.total ?? 0} logged — deleting an event also removes its
          snapshot
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading events…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events logged yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Snapshot</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>ROI</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <EventListItem
                  key={event.id}
                  event={event}
                  actions={
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={deleteEvent.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete this event?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently removes the event record and its
                            snapshot image.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(event.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  }
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminPage() {
  return (
    <div className="h-full overflow-y-auto p-5">
      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts" className="mt-4">
          <AccountsTab />
        </TabsContent>
        <TabsContent value="events" className="mt-4">
          <EventsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
