import { prisma } from "@/lib/db";
export async function GET(request: Request) {
  const status = new URL(request.url).searchParams.get("status");
  return Response.json(await prisma.order.findMany({ where: status ? { status } : {} }));
}
