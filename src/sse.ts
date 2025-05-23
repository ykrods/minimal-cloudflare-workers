import { DurableObject } from "cloudflare:workers";

type Subscriber = {
  stream: WritableStream
  timeout: ReturnType<typeof setTimeout>
  start: Date
}

export interface Env {
  SSE_HUB: DurableObjectNamespace<SSEHub>;
}

export class SSEHub extends DurableObject {
  #subscribers: Subscriber[] = []

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  subscribe(stream: WritableStream) {

    const timeout = setTimeout(() => {
      const index = this.#subscribers.findIndex(s => s.stream === stream);
      if (index !== -1) {
        const writer = stream.getWriter();
        writer.close(); // force close
        this.#subscribers.splice(index, 1);
        this.publish("disconnected", { subscribers: this.#subscribers.length });
      }
    }, 1000 * 5);

    this.#subscribers.push({
      stream,
      timeout,
      start: new Date(),
    })

    this.publish("connected", { subscribers: this.#subscribers.length })
  }

  async publish(name: string, data: Record<string, any>) {
    const encoder = new TextEncoder();

    const survivors = [];

    for (const { stream, timeout, start } of this.#subscribers) {
      const writer = stream.getWriter();
      try {
        await writer.write(encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`));
        survivors.push({ stream, timeout, start });
      } catch (e) {
        console.error(e)
        writer.close();
        clearTimeout(timeout);
      } finally {
        writer.releaseLock();
      }
    }

    this.#subscribers = survivors;
  }
}

export default {
  async fetch(request: Request, env: Env) {
    const id = env.SSE_HUB.idFromName("shared");
    const stub = env.SSE_HUB.get(id);
    const url = new URL(request.url);

    if (url.pathname === "/events") {
      const { readable, writable } = new TransformStream();

      await stub.subscribe(writable)

      return new Response(readable, {
        headers: {
          Connection: "keep-alive",
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }
    // 本来 static asset でよいが面倒なので
    if (url.pathname === "/") {
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>sse client</title>
  <meta charset="utf-8">
  <script>
    window.eventSource = new EventSource("/events")
    eventSource.addEventListener("open", (e) => {
      console.log("open")
    })
    eventSource.addEventListener("error", (e) => {
      console.log("error", e, e.message)
    })

    eventSource.addEventListener("message", (e) => {
      console.log("message", e.data)
    })

    eventSource.addEventListener("connected", (e) => {
      console.log("connected", e.data)
    })
  </script>
</head>
<body>
  <h1>SSE Client</h1>
  <button onclick="window.eventSource.close()">close</button>
</body>
</html>`;

      return new Response(html, {
        headers: {
          "content-type": "text/html;charset=UTF-8",
        },
      });
    }
    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>
