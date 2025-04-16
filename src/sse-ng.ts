/**
 * NG pattern. Promise cannot be passed between contexts
 */
const connections: WritableStream[] = []

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname === "/events") {
      const encoder = new TextEncoder();
      const { readable, writable } = new TransformStream();
      connections.push(writable);

      // broadcast
      for (let stream of connections) {
        const writer = stream.getWriter();
        try {
          await writer.write(encoder.encode(`data: ${connections.length}\n\n`));
        } catch (e) {
          writer.close()
          // toodo remove from connections
        } finally {
          writer.releaseLock();
        }
      }

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
