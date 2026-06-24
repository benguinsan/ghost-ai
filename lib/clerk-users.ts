interface ClerkUserSummary {
  displayName: string | null
  avatarUrl: string | null
}

interface ClerkUserResponse {
  email_addresses?: Array<{
    email_address?: string
  }>
  first_name?: string | null
  last_name?: string | null
  username?: string | null
  image_url?: string | null
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function getDisplayName(user: ClerkUserResponse) {
  const firstName = user.first_name?.trim() ?? ""
  const lastName = user.last_name?.trim() ?? ""
  const fullName = [firstName, lastName].filter(Boolean).join(" ")

  if (fullName) {
    return fullName
  }

  const username = user.username?.trim()
  return username || null
}

export async function getClerkUsersByEmails(emails: string[]): Promise<Map<string, ClerkUserSummary>> {
  if (!emails.length) {
    return new Map()
  }

  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    return new Map()
  }

  const params = new URLSearchParams()
  for (const email of emails) {
    params.append("email_address[]", normalizeEmail(email))
  }

  try {
    const response = await fetch(`https://api.clerk.com/v1/users?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      return new Map()
    }

    const users = (await response.json()) as ClerkUserResponse[]
    const usersByEmail = new Map<string, ClerkUserSummary>()

    for (const user of users) {
      const displayName = getDisplayName(user)
      const avatarUrl = user.image_url ?? null

      for (const emailAddress of user.email_addresses ?? []) {
        const email = emailAddress.email_address
        if (!email) {
          continue
        }

        usersByEmail.set(normalizeEmail(email), {
          displayName,
          avatarUrl,
        })
      }
    }

    return usersByEmail
  } catch (error) {
    console.error("Failed to fetch Clerk user profiles by email.", error)
    return new Map()
  }
}
