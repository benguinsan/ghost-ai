import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/app/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to initialize Prisma");
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const SSL_MODE_ALIASES = new Set(["prefer", "require", "verify-ca"]);

function normalizeDatabaseUrl(url: string) {
  if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
    return url;
  }

  try {
    const parsedUrl = new URL(url);
    const sslMode = parsedUrl.searchParams.get("sslmode");

    if (sslMode && SSL_MODE_ALIASES.has(sslMode)) {
      parsedUrl.searchParams.set("sslmode", "verify-full");
      return parsedUrl.toString();
    }
  } catch {
    return url;
  }

  return url;
}

const createPrismaClient = () => {
  if (databaseUrl.startsWith("prisma+postgres://")) {
    return new PrismaClient({
      accelerateUrl: databaseUrl,
    });
  }

  const normalizedDatabaseUrl = normalizeDatabaseUrl(databaseUrl);

  return new PrismaClient({
    adapter: new PrismaPg(normalizedDatabaseUrl),
  });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
