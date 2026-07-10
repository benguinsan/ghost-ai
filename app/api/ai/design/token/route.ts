import { auth as clerkAuth } from "@clerk/nextjs/server";
import { auth as triggerAuth } from "@trigger.dev/sdk";

import { badRequestResponse, forbiddenResponse, unauthorizedResponse } from "@/lib/api-responses";
import { prisma } from "@/lib/prisma";

interface DesignTokenRequestBody {
  runId?: unknown;
}

export async function POST(request: Request) {
  const { userId } = await clerkAuth();

  if (!userId) {
    return unauthorizedResponse();
  }

  const payload = (await request.json().catch(() => ({}))) as DesignTokenRequestBody;

  if (typeof payload.runId !== "string" || payload.runId.trim().length === 0) {
    return badRequestResponse("A runId is required.");
  }

  const runId = payload.runId.trim();

  const taskRun = await prisma.taskRun.findUnique({
    where: {
      runId,
    },
    select: {
      runId: true,
      userId: true,
    },
  });

  if (!taskRun || taskRun.userId !== userId) {
    return forbiddenResponse();
  }

  try {
    const token = await triggerAuth.createPublicToken({
      scopes: {
        read: {
          runs: [runId],
        },
      },
      expirationTime: "1h",
    });

    return Response.json({ token });
  } catch (error) {
    console.error("Failed to create run-scoped Trigger.dev token.", error);
    return Response.json({ error: "Failed to create access token." }, { status: 502 });
  }
}
