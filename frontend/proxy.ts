export default async function proxy(request: Request): Promise<Response> {
  const apiOrigin = process.env.API_URL;
  if (!apiOrigin) {
    return Response.json({ detail: "API_URL belum dikonfigurasi" }, { status: 503 });
  }
  const incoming = new URL(request.url);
  const target = new URL(`${incoming.pathname}${incoming.search}`, apiOrigin);
  return fetch(new Request(target, request));
}