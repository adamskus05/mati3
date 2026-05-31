import { listPlatformAdmins } from "@/lib/actions/signup-access";
import { PlatformAdminsPanel } from "@/components/admin/platform-admins-panel";

export default async function AdminAdminsPage() {
  const admins = await listPlatformAdmins();

  return (
    <div className="space-y-2">
      <h2 className="font-heading text-xl font-semibold">Plattformsadministratörer</h2>
      <p className="text-sm text-muted-foreground">
        Endast administratörer kan godkänna åtkomstbegäran och bjuda in nya användare.
      </p>
      <PlatformAdminsPanel admins={admins} />
    </div>
  );
}
