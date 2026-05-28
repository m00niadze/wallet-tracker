import { NextResponse } from "next/server";
import { eventBus } from "@/lib/event-bus";
import type { StoredTransaction } from "@/lib/helius/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat so the connection is established
      controller.enqueue(encoder.encode(": connected\n\n"));

      const listener = (tx: StoredTransaction) => {
        try {
          const data = `data: ${JSON.stringify(tx)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          eventBus.offTransaction(listener);
        }
      };

      eventBus.onTransaction(listener);

      // Heartbeat every 30s to keep connection alive through proxies
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          eventBus.offTransaction(listener);
        }
      }, 30_000);

      // Cleanup when client disconnects
      const cleanup = () => {
        clearInterval(heartbeat);
        eventBus.offTransaction(listener);
      };

      // ReadableStream cancel is called on client disconnect
      return cleanup;
    },
    cancel() {
      // handled above via the return value of start()
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
