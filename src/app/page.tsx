import Link from "next/link";
import { SignInButton, SignUpButton, Show } from "@clerk/nextjs";
import { buttonVariants } from "@/components/ui/button-variants";
import { Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-24 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center justify-center size-16 rounded-2xl bg-primary text-primary-foreground">
          <Dumbbell className="size-8" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Lifting Dairy
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">
          Track your workouts, log your sets and reps, and watch your strength grow over time.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Show when="signed-out">
          <SignUpButton mode="modal">
            <button className={cn(buttonVariants({ size: "lg" }), "min-w-36")}>Get Started</button>
          </SignUpButton>
          <SignInButton mode="modal">
            <button className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-w-36")}>Sign In</button>
          </SignInButton>
        </Show>
        <Show when="signed-in">
          <Link href="/dashboard" className={cn(buttonVariants({ size: "lg" }), "min-w-36")}>
            Go to Dashboard
          </Link>
        </Show>
      </div>
    </main>
  );
}
