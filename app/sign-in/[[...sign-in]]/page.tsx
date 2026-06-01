import { SignIn } from "@clerk/nextjs"

import { AuthPageShell } from "@/components/auth/auth-page-shell"

export default function SignInPage() {
  return (
    <AuthPageShell
      subtitle="Sign in to continue building and collaborating on your architecture workspace."
      title="Welcome back"
    >
      <SignIn
        appearance={{
          elements: {
            card: "bg-transparent shadow-none",
            footerActionLink: "text-brand",
            formButtonPrimary: "bg-brand text-background hover:bg-brand/90",
            socialButtonsBlockButtonText: "text-copy-primary",
          },
        }}
      />
    </AuthPageShell>
  )
}
