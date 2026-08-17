import type { Metadata } from "next";
import { Suspense } from "react";

import { ProfileForm } from "./profile-form";
import { AppearanceCard } from "@/components/dashboard/appearance-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentAdmin } from "@/lib/api/endpoints/user";
import { formatDhaka } from "@/lib/dhaka-date";

export const metadata: Metadata = { title: "Settings" };

async function ProfileCard() {
  const admin = await getCurrentAdmin();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Your name and email identify you on every schedule change and reminder
          broadcast in the audit trail. Leave a field blank to keep it as it is.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ProfileForm admin={admin} />
      </CardContent>
    </Card>
  );
}

async function AccountCard() {
  const admin = await getCurrentAdmin();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>
          Read-only. Admin accounts are provisioned by the backend&rsquo;s seed
          script, not from this dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">Role</dt>
            <dd className="font-medium">{admin.role}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">Status</dt>
            <dd className="font-medium">{admin.status}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">Phone</dt>
            <dd className="font-medium">{admin.phone ?? "Not recorded"}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">Account created</dt>
            <dd className="font-medium">{formatDhaka(admin.createdAt)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function CardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-full max-w-md" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Your admin profile and workspace preferences.
        </p>
      </div>

      <AppearanceCard />

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<CardSkeleton rows={5} />}>
          <ProfileCard />
        </Suspense>
        <Suspense fallback={<CardSkeleton rows={2} />}>
          <AccountCard />
        </Suspense>
      </div>
    </div>
  );
}
