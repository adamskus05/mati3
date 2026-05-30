
/**
 * Regenerate with `npm run db:types` (requires linked Supabase / local).
 * App-specific types live in database.types.ts.
 */
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
          role: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          role?: string;
          joined_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          user_id?: string;
          role?: string;
          joined_at?: string;
        };
      };
      household_events: {
        Row: {
          id: string;
          household_id: string;
          actor_id: string | null;
          event_type: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          actor_id?: string | null;
          event_type: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          actor_id?: string | null;
          event_type?: string;
          metadata?: Json;
          created_at?: string;
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
          shopper_id: string | null;
          shopper_started_at: string | null;
          deleted_by: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          shopper_id?: string | null;
          shopper_started_at?: string | null;
          deleted_by?: string | null;
          sort_order?: number;
        };
        Update: {
          id?: string;
          household_id?: string;
          name?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          shopper_id?: string | null;
          shopper_started_at?: string | null;
          deleted_by?: string | null;
          sort_order?: number;
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
          completed_by: string | null;
          completed_at: string | null;
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
          completed_by?: string | null;
          completed_at?: string | null;
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
          completed_by?: string | null;
          completed_at?: string | null;
        };
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          created_at?: string;
        };
      };
      user_preferences: {
        Row: {
          user_id: string;
          preferences: Json;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          preferences?: Json;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          preferences?: Json;
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
      recipes: {
        Row: {
          id: string;
          household_id: string;
          title: string;
          source_url: string | null;
          image_url: string | null;
          instructions: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          title: string;
          source_url?: string | null;
          image_url?: string | null;
          instructions?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          title?: string;
          source_url?: string | null;
          image_url?: string | null;
          instructions?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      recipe_ingredients: {
        Row: {
          id: string;
          recipe_id: string;
          name: string;
          quantity: number | null;
          unit: string | null;
          notes: string | null;
          section: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          name: string;
          quantity?: number | null;
          unit?: string | null;
          notes?: string | null;
          section?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipe_id?: string;
          name?: string;
          quantity?: number | null;
          unit?: string | null;
          notes?: string | null;
          section?: string | null;
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
      get_recipe_household_id: {
        Args: { p_recipe_id: string };
        Returns: string;
      };
      is_household_owner: {
        Args: { p_household_id: string };
        Returns: boolean;
      };
      renew_household_invite_code: {
        Args: { p_household_id: string };
        Returns: string;
      };
      transfer_household_ownership: {
        Args: { p_household_id: string; p_new_owner_user_id: string };
        Returns: undefined;
      };
      leave_household: {
        Args: { p_household_id: string };
        Returns: undefined;
      };
      remove_household_member: {
        Args: { p_household_id: string; p_user_id: string };
        Returns: undefined;
      };
      update_household_name: {
        Args: { p_household_id: string; p_name: string };
        Returns: Database["public"]["Tables"]["households"]["Row"];
      };
      set_list_shopper: {
        Args: { p_list_id: string };
        Returns: Database["public"]["Tables"]["shopping_lists"]["Row"];
      };
      clear_list_shopper: {
        Args: { p_list_id: string };
        Returns: Database["public"]["Tables"]["shopping_lists"]["Row"];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
