export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          created_at?: string;
        };
      };
      households: {
        Row: {
          id: string;
          name: string;
          invite_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          invite_code: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          invite_code?: string;
          created_at?: string;
        };
      };
      household_members: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          joined_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          user_id?: string;
          joined_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          color: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          color?: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          name?: string;
          color?: string;
          sort_order?: number;
          created_at?: string;
        };
      };
      shopping_lists: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          household_id?: string;
          name?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      shopping_items: {
        Row: {
          id: string;
          shopping_list_id: string;
          category_id: string | null;
          name: string;
          quantity: number | null;
          unit: string | null;
          notes: string | null;
          completed: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shopping_list_id: string;
          category_id?: string | null;
          name: string;
          quantity?: number | null;
          unit?: string | null;
          notes?: string | null;
          completed?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shopping_list_id?: string;
          category_id?: string | null;
          name?: string;
          quantity?: number | null;
          unit?: string | null;
          notes?: string | null;
          completed?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      item_presets: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          default_quantity: number | null;
          default_unit: string | null;
          category_id: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          default_quantity?: number | null;
          default_unit?: string | null;
          category_id?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          name?: string;
          default_quantity?: number | null;
          default_unit?: string | null;
          category_id?: string | null;
          sort_order?: number;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_household: {
        Args: { p_name: string };
        Returns: Database["public"]["Tables"]["households"]["Row"];
      };
      join_household_by_code: {
        Args: { p_code: string };
        Returns: Database["public"]["Tables"]["households"]["Row"];
      };
      generate_invite_code: {
        Args: Record<string, never>;
        Returns: string;
      };
      is_household_member: {
        Args: { p_household_id: string };
        Returns: boolean;
      };
      get_item_household_id: {
        Args: { p_list_id: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

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
};

export type MemberWithProfile = HouseholdMember & {
  profile: Pick<Profile, "display_name" | "email">;
};
