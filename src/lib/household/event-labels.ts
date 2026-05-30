import type { Json } from "@/lib/database.types";
import { profileDisplayName } from "@/lib/profiles/display-name";

type Actor = { display_name?: string | null; email?: string | null } | null;

function actorName(actor: Actor, metadataUserId?: string, selfUserId?: string) {
  if (metadataUserId && selfUserId && metadataUserId === selfUserId) {
    return "Du";
  }
  return profileDisplayName(actor ?? undefined);
}

function metaString(metadata: Json, key: string): string | undefined {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const v = metadata[key];
    return typeof v === "string" ? v : undefined;
  }
  return undefined;
}

export function formatHouseholdEvent(
  eventType: string,
  metadata: Json,
  actor: Actor,
  membersByUserId: Map<string, Actor>,
  selfUserId?: string
): string {
  const listName = metaString(metadata, "list_name");
  const householdName = metaString(metadata, "household_name");
  const newOwnerId = metaString(metadata, "new_owner_user_id");
  const joinedUserId = metaString(metadata, "user_id");
  const who = actorName(actor, undefined, selfUserId);

  switch (eventType) {
    case "household_created":
      return `${who} skapade hushållet${householdName ? ` „${householdName}"` : ""}`;
    case "member_joined":
      return `${actorName(membersByUserId.get(joinedUserId ?? "") ?? actor, joinedUserId, selfUserId)} gick med i hushållet`;
    case "member_left":
      return `${actorName(membersByUserId.get(joinedUserId ?? "") ?? actor, joinedUserId, selfUserId)} lämnade hushållet`;
    case "member_removed": {
      const removedId = metaString(metadata, "user_id");
      return `${who} tog bort ${actorName(
        membersByUserId.get(removedId ?? "") ?? null,
        removedId,
        selfUserId
      )} från hushållet`;
    }
    case "invite_code_renewed":
      return `${who} förnyade inbjudningskoden`;
    case "ownership_transferred": {
      const newOwner = newOwnerId
        ? membersByUserId.get(newOwnerId)
        : null;
      return `${who} överförde ägarskapet till ${profileDisplayName(newOwner ?? undefined)}`;
    }
    case "list_created":
      return `${who} skapade listan${listName ? ` „${listName}"` : ""}`;
    case "list_archived":
      return `${who} arkiverade listan${listName ? ` „${listName}"` : ""}`;
    case "shopping_started":
      return `${who} började handla${listName ? ` („${listName}")` : ""}`;
    case "shopping_ended":
      return `${who} slutade handla${listName ? ` („${listName}")` : ""}`;
    case "household_renamed": {
      const newName = metaString(metadata, "new_name");
      return `${who} bytte hushållsnamn${newName ? ` till „${newName}"` : ""}`;
    }
    case "household_deleted":
      return `${who} tog bort hushållet`;
    default:
      return `${who}: ${eventType}`;
  }
}
