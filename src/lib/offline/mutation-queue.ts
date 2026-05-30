import { get, set } from "idb-keyval";
import type { SupabaseClient } from "@supabase/supabase-js";

const QUEUE_KEY = "mati:mutation-queue";

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
      payload: {
        name: string;
        category_id: string | null;
        sort_order: number;
        quantity?: number | null;
        unit?: string | null;
      };
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
        const { error } = await supabase
          .from("shopping_items")
          .update({
            completed: m.completed,
            sort_order: m.sort_order,
            completed_by: m.completed ? userId : null,
            completed_at: m.completed ? new Date().toISOString() : null,
          })
          .eq("id", m.itemId);
        if (error) throw error;
      } else if (m.type === "delete_item") {
        const { error } = await supabase
          .from("shopping_items")
          .delete()
          .eq("id", m.itemId);
        if (error) throw error;
      } else if (m.type === "add_item") {
        const { error } = await supabase.from("shopping_items").insert({
          shopping_list_id: m.listId,
          name: m.payload.name,
          category_id: m.payload.category_id,
          sort_order: m.payload.sort_order,
          quantity: m.payload.quantity ?? null,
          unit: m.payload.unit ?? null,
        });
        if (error) throw error;
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
