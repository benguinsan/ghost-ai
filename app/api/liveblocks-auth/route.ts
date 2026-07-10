import { auth, currentUser } from "@clerk/nextjs/server";

import { badRequestResponse, forbiddenResponse, unauthorizedResponse } from "@/lib/api-responses";
import { getAccessibleProjectByRoom } from "@/lib/project-access";
import { getCursorColorFromUserId, getLiveblocksClient, getLiveblocksSecret } from "@/lib/liveblocks";

interface LiveblocksAuthRequestBody {
  room?: unknown;
}

function serverErrorResponse(message: string) {
  return Response.json({ error: message }, { status: 503 });
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

  const payload = (await request.json().catch(() => ({}))) as LiveblocksAuthRequestBody;

  if (typeof payload.room !== "string" || payload.room.trim().length === 0) {
    return badRequestResponse("Liveblocks room ID is required.");
  }

  const roomId = payload.room.trim();
  const project = await getAccessibleProjectByRoom({
    roomId,
    userId,
    primaryEmail,
  });

  if (!project) {
    return forbiddenResponse();
  }

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  const fallbackName = user?.username ?? primaryEmail.split("@")[0] ?? "User";
  const name = displayName || fallbackName;
  const avatar = user?.imageUrl ?? "";
  const color = getCursorColorFromUserId(userId);
  const liveblocks = getLiveblocksClient();

  if (!liveblocks) {
    const hasSecretConfigured = Boolean(getLiveblocksSecret());
    const missingSecretMessage = hasSecretConfigured
      ? "Liveblocks client is unavailable."
      : "Liveblocks is not configured. Set LIVEBLOCKS_SECRET_KEY (or LIVEBLOCKS_SECRET).";

    return serverErrorResponse(missingSecretMessage);
  }

  await liveblocks.getOrCreateRoom(project.id, {
    defaultAccesses: [],
  });

  const session = liveblocks.prepareSession(userId, {
    userInfo: {
      name,
      avatar,
      color,
    },
  });

  session.allow(project.id, session.FULL_ACCESS);
  const { body, status } = await session.authorize();

  return new Response(body, { status });
}
