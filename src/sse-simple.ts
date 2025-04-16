export default {
  fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname === "/events") {
      const encoder = new TextEncoder();
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      let n = 0;
      const intervalId = setInterval(async () => {
        try {
          await writer.write(encoder.encode(`data: ${n}\n\n`));
          n++;
        } catch (e) {
          console.error(e)
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
