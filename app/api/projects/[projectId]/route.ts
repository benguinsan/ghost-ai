import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";

interface ProjectRouteContext {
  params: Promise<{
    projectId: string;
  }>;
}

interface RenameProjectRequestBody {
  name?: unknown;
}

function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function forbiddenResponse() {
  return Response.json({ error: "Forbidden" }, { status: 403 });
}

function badRequestResponse(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

export async function PATCH(request: Request, context: ProjectRouteContext) {
  const { userId } = await auth();

  if (!userId) {
    return unauthorizedResponse();
  }

  const { projectId } = await context.params;
  const payload = (await request.json().catch(() => ({}))) as RenameProjectRequestBody;
  const name = typeof payload.name === "string" ? payload.name.trim() : "";

  if (!name) {
    return badRequestResponse("Project name is required.");
  }

  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
    select: {
      ownerId: true,
    },
  });

  if (!project || project.ownerId !== userId) {
    return forbiddenResponse();
  }

  const updatedProject = await prisma.project.update({
    where: {
      id: projectId,
    },
    data: {
      name,
    },
  });

  return Response.json({ project: updatedProject });
}

export async function DELETE(_request: Request, context: ProjectRouteContext) {
  const { userId } = await auth();

  if (!userId) {
    return unauthorizedResponse();
  }

  const { projectId } = await context.params;

  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
    select: {
      ownerId: true,
    },
  });

  if (!project || project.ownerId !== userId) {
    return forbiddenResponse();
  }

  await prisma.project.delete({
    where: {
      id: projectId,
    },
  });

  return Response.json({ success: true });
}
