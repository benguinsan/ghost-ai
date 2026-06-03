import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";

interface CreateProjectRequestBody {
  name?: unknown;
  description?: unknown;
  roomId?: unknown;
}

function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function badRequestResponse(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return unauthorizedResponse();
  }

  const projects = await prisma.project.findMany({
    where: {
      ownerId: userId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return Response.json({ projects });
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return unauthorizedResponse();
  }

  const payload = (await request.json().catch(() => ({}))) as CreateProjectRequestBody;

  if (
    payload.name !== undefined &&
    (typeof payload.name !== "string" || payload.name.trim().length === 0)
  ) {
    return badRequestResponse("Project name must be a non-empty string when provided.");
  }

  if (payload.description !== undefined && typeof payload.description !== "string") {
    return badRequestResponse("Project description must be a string when provided.");
  }

  if (
    payload.roomId !== undefined &&
    (typeof payload.roomId !== "string" || payload.roomId.trim().length === 0)
  ) {
    return badRequestResponse("Project roomId must be a non-empty string when provided.");
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "Untitled Project";
  const description = typeof payload.description === "string" ? payload.description.trim() : undefined;
  const roomId = typeof payload.roomId === "string" ? payload.roomId.trim() : undefined;

  const project = await prisma.project.create({
    data: {
      id: roomId,
      ownerId: userId,
      name,
      description: description ? description : null,
    },
  });

  return Response.json({ project }, { status: 201 });
}
