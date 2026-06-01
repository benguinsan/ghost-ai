import { SignUp } from "@clerk/nextjs"

import { AuthPageShell } from "@/components/auth/auth-page-shell"

export default function SignUpPage() {
  return (
    <AuthPageShell
      subtitle="Create your account to start mapping systems with Ghost AI."
      title="Create your account"
    >
      <SignUp
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
