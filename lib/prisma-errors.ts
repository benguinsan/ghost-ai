export function isPrismaInfrastructureError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()

  return (
    message.includes("connection terminated") ||
    message.includes("connection refused") ||
    message.includes("econnreset") ||
    message.includes("connect timeout") ||
    message.includes("can't reach database") ||
    message.includes("server has closed the connection") ||
    message.includes("too many connections")
  )
}
