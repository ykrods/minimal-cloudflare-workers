const connections: { id: string, inbox: number[] } = []
let counter = 0

export default {
  fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname === "/events") {
      const encoder = new TextEncoder();
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();

      const id = counter
      counter++

      const inbox = []
      connections.push({ id, inbox })

      // broadcast
      connections.forEach(({ inbox }) => inbox.push(connections.length))

      const intervalId = setInterval(async () => {
        try {
          while (0 < inbox.length) {
            const n = inbox.shift()
            await writer.write(encoder.encode(`data: ${n}\n\n`));
          }
        } catch (e) {
          writer.close()
          clearInterval(intervalId);
        }
      }, 1000)

      return new Response(readable, {
        headers: {
          Connection: "keep-alive",
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }
    return new Response(null, { status: 404 });
  },
}
