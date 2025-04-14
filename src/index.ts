export default {
  fetch(request: Request, env: Env) {
    return Response.json({ message: "Hello" })
  },
}
