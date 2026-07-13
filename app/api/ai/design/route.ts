import { auth, currentUser } from "@clerk/nextjs/server";
import { auth as triggerAuth, tasks } from "@trigger.dev/sdk";

import { badRequestResponse, forbiddenResponse, unauthorizedResponse } from "@/lib/api-responses";
import { getAccessibleProjectByRoom } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import type { designAgentTask } from "@/trigger/design-agent";

interface DesignRequestBody {
  prompt?: unknown;
  roomId?: unknown;
  projectId?: unknown;
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return unauthorizedResponse();
  }

  const user = await currentUser();
  const primaryEmail = user?.emailAddresses[0]?.emailAddress ?? null;

  if (!primaryEmail) {
    return forbiddenResponse();
  }

  const payload = (await request.json().catch(() => ({}))) as DesignRequestBody;

  if (typeof payload.prompt !== "string" || payload.prompt.trim().length === 0) {
    return badRequestResponse("A non-empty design prompt is required.");
  }

  if (typeof payload.roomId !== "string" || payload.roomId.trim().length === 0) {
    return badRequestResponse("A roomId is required.");
  }

  if (typeof payload.projectId !== "string" || payload.projectId.trim().length === 0) {
    return badRequestResponse("A projectId is required.");
  }

  const prompt = payload.prompt.trim();
  const roomId = payload.roomId.trim();
  const projectId = payload.projectId.trim();

  const project = await getAccessibleProjectByRoom({
    roomId: projectId,
    userId,
    primaryEmail,
  });

  if (!project) {
    return forbiddenResponse();
  }

  try {
    const handle = await tasks.trigger<typeof designAgentTask>("design-agent", {
      prompt,
      roomId,
    });

    await prisma.taskRun.create({
      data: {
        runId: handle.id,
        projectId: project.id,
        userId,
      },
    });

    // Run-scoped public token so the client can subscribe with `useRealtimeRun`.
    const publicToken = await triggerAuth.createPublicToken({
      scopes: {
        read: {
          runs: [handle.id],
        },
      },
      expirationTime: "1h",
    });

    return Response.json({ runId: handle.id, publicToken }, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Failed to trigger design agent task.", error);
    return Response.json(
      { error: "Failed to start design generation.", detail },
      { status: 502 },
    );
  }
}
