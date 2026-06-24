import { Liveblocks } from "@liveblocks/node";

const CURSOR_COLOR_PALETTE = [
  "#52A8FF",
  "#BF7AF0",
  "#FF990A",
  "#FF6166",
  "#F75F8F",
  "#62C073",
  "#0AC7B4",
  "#8B82FF",
] as const;

const globalForLiveblocks = globalThis as unknown as {
  liveblocks: Liveblocks | undefined;
};

const LIVEBLOCKS_SECRET_ENV_KEYS = ["LIVEBLOCKS_SECRET_KEY", "LIVEBLOCKS_SECRET"] as const

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function getCursorColorFromUserId(userId: string) {
  const colorIndex = hashString(userId) % CURSOR_COLOR_PALETTE.length;
  return CURSOR_COLOR_PALETTE[colorIndex];
}

export function getLiveblocksSecret() {
  for (const key of LIVEBLOCKS_SECRET_ENV_KEYS) {
    const value = process.env[key]?.trim()
    if (value) {
      return value
    }
  }

  return null
}

function createLiveblocksClient() {
  const secret = getLiveblocksSecret();

  if (!secret) {
    return null;
  }

  return new Liveblocks({
    secret,
  });
}

export function getLiveblocksClient() {
  const cachedClient = globalForLiveblocks.liveblocks;
  if (cachedClient) {
    return cachedClient;
  }

  const client = createLiveblocksClient();
  if (!client) {
    return null;
  }

  if (process.env.NODE_ENV !== "production") {
    globalForLiveblocks.liveblocks = client;
  }

  return client;
}
