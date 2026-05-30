"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { QUERY_KEYS } from "@/lib/constants";
import { debouncedInvalidate } from "@/lib/query/debounced-invalidate";
import { applyShoppingItemRealtime } from "@/lib/query/realtime-merge";

export function useHouseholdRealtime(householdId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`household:${householdId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_lists",
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          debouncedInvalidate(queryClient, QUERY_KEYS.lists(householdId));
          debouncedInvalidate(queryClient, QUERY_KEYS.listHistory(householdId));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "categories",
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          debouncedInvalidate(queryClient, QUERY_KEYS.categories(householdId));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "recipe_categories",
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          debouncedInvalidate(queryClient, QUERY_KEYS.recipeCategories(householdId));
          debouncedInvalidate(queryClient, QUERY_KEYS.recipes(householdId));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "recipes",
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          debouncedInvalidate(queryClient, QUERY_KEYS.recipes(householdId));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "household_members",
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          debouncedInvalidate(queryClient, QUERY_KEYS.members(householdId));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "household_events",
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          debouncedInvalidate(queryClient, QUERY_KEYS.events(householdId));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "item_presets",
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          debouncedInvalidate(queryClient, QUERY_KEYS.presets(householdId));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, queryClient]);
}

export function useListItemsRealtime(listId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`list-items:${listId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_items",
          filter: `shopping_list_id=eq.${listId}`,
        },
        (payload) => {
          applyShoppingItemRealtime(
            queryClient,
            listId,
            QUERY_KEYS.items(listId),
            payload as {
              eventType: "INSERT" | "UPDATE" | "DELETE";
              new: Record<string, unknown> | null;
              old: Record<string, unknown> | null;
            }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [listId, queryClient]);
}
