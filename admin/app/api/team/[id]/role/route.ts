import { badBody, readBody, readJson, rejectCrossOrigin, upstream } from '../../../../../lib/bff';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  const { id } = await context.params;
  // Só id de conta: ".." ou outro trecho levaria o pedido para outra rota da API.
  if (!uuid.test(id)) return Response.json({ message: 'Conta não encontrada.' }, { status: 404 });
  const body = await readBody(request);
  if (body === null) return badBody();
  const upstreamResponse = await upstream(`/admin/v1/team/${id}/role`, request, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const payload = await readJson(upstreamResponse);
  return Response.json(payload, { status: upstreamResponse.status });
}
