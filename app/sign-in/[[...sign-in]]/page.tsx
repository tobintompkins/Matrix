import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 text-white">
      <div className="mb-10 text-center">
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-400">
          Enterprise Service Platform
        </p>
        <h1 className="mt-3 text-5xl font-bold tracking-widest text-cyan-400">
          MATRIX
        </h1>
        <p className="mt-4 max-w-md text-sm text-slate-400">
          Sign in with email or SSO to access fleet service, inventory, scanner,
          and parts workflows.
        </p>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-black/40">
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/dashboard"
          appearance={{
            elements: {
              rootBox: "mx-auto w-full",
              card: "bg-transparent shadow-none",
            },
          }}
        />
      </div>
    </main>
  );
}
