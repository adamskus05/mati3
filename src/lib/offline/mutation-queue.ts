import { get, set } from "idb-keyval";
import type { SupabaseClient } from "@supabase/supabase-js";

const QUEUE_KEY = "mati:mutation-queue";

/** Maps optimistic client ids to server ids after add_item flush. */
const clientIdToServerId = new Map<string, string>();

export function isPendingSyncItemId(itemId: string): boolean {
  return itemId.startsWith("optimistic-");
}

export function resolveQueuedItemId(itemId: string): string {
  return clientIdToServerId.get(itemId) ?? itemId;
}

export type QueuedMutation =
  | {
      type: "toggle_item";
      listId: string;
      itemId: string;
      completed: boolean;
      sort_order: number;
      completed_by: string | null;
      completed_at: string | null;
    }
  | {
      type: "delete_item";
      listId: string;
      itemId: string;
    }
  | {
      type: "add_item";
      listId: string;
      clientId: string;
      payload: {
        name: string;
        category_id: string | null;
        sort_order: number;
        quantity?: number | null;
        unit?: string | null;
        notes?: string | null;
      };
    }
  | {
      type: "update_item";
      listId: string;
      itemId: string;
      payload: {
        name: string;
        category_id: string | null;
        quantity: number | null;
        unit: string | null;
        notes: string | null;
      };
    }
  | {
      type: "reorder_items";
      listId: string;
      updates: { itemId: string; sort_order: number }[];
    }
  | {
      type: "bulk_update_category";
      listId: string;
      itemIds: string[];
      category_id: string | null;
    };

async function readQueue(): Promise<QueuedMutation[]> {
  return (await get<QueuedMutation[]>(QUEUE_KEY)) ?? [];
}

async function writeQueue(queue: QueuedMutation[]) {
  await set(QUEUE_KEY, queue);
}

export async function enqueueMutation(mutation: QueuedMutation) {
  const queue = await readQueue();
  queue.push(mutation);
  await writeQueue(queue);
}

function canResolveItemId(itemId: string): boolean {
  if (!isPendingSyncItemId(itemId)) return true;
  return clientIdToServerId.has(itemId);
}

export async function flushMutationQueue(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const queue = await readQueue();
  if (queue.length === 0) return 0;

  const remaining: QueuedMutation[] = [];

  for (const m of queue) {
    try {
      if (m.type === "toggle_item") {
        if (!canResolveItemId(m.itemId)) {
          remaining.push(m);
          continue;
        }
        const itemId = resolveQueuedItemId(m.itemId);
        const { error } = await supabase
          .from("shopping_items")
          .update({
            completed: m.completed,
            sort_order: m.sort_order,
            completed_by: m.completed ? userId : null,
            completed_at: m.completed
              ? (m.completed_at ?? new Date().toISOString())
              : null,
          })
          .eq("id", itemId);
        if (error) throw error;
      } else if (m.type === "delete_item") {
        if (!canResolveItemId(m.itemId)) {
          remaining.push(m);
          continue;
        }
        const itemId = resolveQueuedItemId(m.itemId);
        const { error } = await supabase
          .from("shopping_items")
          .delete()
          .eq("id", itemId);
        if (error) throw error;
      } else if (m.type === "add_item") {
        const { data, error } = await supabase
          .from("shopping_items")
          .insert({
            shopping_list_id: m.listId,
            name: m.payload.name,
            category_id: m.payload.category_id,
            sort_order: m.payload.sort_order,
            quantity: m.payload.quantity ?? null,
            unit: m.payload.unit ?? null,
            notes: m.payload.notes ?? null,
          })
          .select("id")
          .single();
        if (error) throw error;
        if (data?.id) {
          clientIdToServerId.set(m.clientId, data.id);
        }
      } else if (m.type === "update_item") {
        if (!canResolveItemId(m.itemId)) {
          remaining.push(m);
          continue;
        }
        const itemId = resolveQueuedItemId(m.itemId);
        const { error } = await supabase
          .from("shopping_items")
          .update(m.payload)
          .eq("id", itemId);
        if (error) throw error;
      } else if (m.type === "reorder_items") {
        const unresolved = m.updates.some((u) => !canResolveItemId(u.itemId));
        if (unresolved) {
          remaining.push(m);
          continue;
        }
        for (const u of m.updates) {
          const itemId = resolveQueuedItemId(u.itemId);
          const { error } = await supabase
            .from("shopping_items")
            .update({ sort_order: u.sort_order })
            .eq("id", itemId);
          if (error) throw error;
        }
      } else if (m.type === "bulk_update_category") {
        const unresolved = m.itemIds.some((id) => !canResolveItemId(id));
        if (unresolved) {
          remaining.push(m);
          continue;
        }
        for (const rawId of m.itemIds) {
          const itemId = resolveQueuedItemId(rawId);
          const { error } = await supabase
            .from("shopping_items")
            .update({ category_id: m.category_id })
            .eq("id", itemId);
          if (error) throw error;
        }
      }
    } catch {
      remaining.push(m);
    }
  }

  await writeQueue(remaining);
  return queue.length - remaining.length;
}

export async function queueLength(): Promise<number> {
  return (await readQueue()).length;
}
