export type { Database, Json } from "./database.types.generated";

import type { Database } from "./database.types.generated";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Household = Database["public"]["Tables"]["households"]["Row"];
export type HouseholdMember =
  Database["public"]["Tables"]["household_members"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type ShoppingList =
  Database["public"]["Tables"]["shopping_lists"]["Row"];
export type ShoppingItem =
  Database["public"]["Tables"]["shopping_items"]["Row"];
export type ItemPreset = Database["public"]["Tables"]["item_presets"]["Row"];

export type ShoppingListWithCreator = ShoppingList & {
  creator?: Pick<Profile, "display_name" | "email"> | null;
  shopper?: Pick<Profile, "display_name" | "email"> | null;
  deleted_by_profile?: Pick<Profile, "display_name" | "email"> | null;
};

export type ShoppingItemWithCompleter = ShoppingItem & {
  completer?: Pick<Profile, "display_name" | "email"> | null;
};

export type HouseholdMemberRole = "owner" | "member";

export type MemberWithProfile = HouseholdMember & {
  role: HouseholdMemberRole;
  profile: Pick<Profile, "display_name" | "email">;
};

export type HouseholdEvent =
  Database["public"]["Tables"]["household_events"]["Row"];

export type HouseholdEventWithActor = HouseholdEvent & {
  actor: Pick<Profile, "display_name" | "email"> | null;
};
