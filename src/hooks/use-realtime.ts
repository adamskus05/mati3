"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { QUERY_KEYS } from "@/lib/constants";

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
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.lists(householdId),
          });
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.listHistory(householdId),
          });
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
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.categories(householdId),
          });
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
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.members(householdId),
          });
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
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.presets(householdId),
          });
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
        () => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.items(listId) });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [listId, queryClient]);
}
