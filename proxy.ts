import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

function toPathPattern(route: string) {
  const normalized = route.startsWith("http") ? new URL(route).pathname : route
  const withLeadingSlash = normalized.startsWith("/") ? normalized : `/${normalized}`

  return `${withLeadingSlash}(.*)`
}

const signInRoute = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? process.env.CLERK_SIGN_IN_URL ?? "/sign-in"
const signUpRoute = process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL ?? process.env.CLERK_SIGN_UP_URL ?? "/sign-up"

const isPublicRoute = createRouteMatcher(["/", toPathPattern(signInRoute), toPathPattern(signUpRoute)])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
