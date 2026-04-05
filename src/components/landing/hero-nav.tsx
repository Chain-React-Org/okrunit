import Link from "next/link";
import { Button } from "@/components/ui/button";

interface HeroNavProps {
  user: { email: string; full_name: string | null } | null;
}

export function HeroNav({ user }: HeroNavProps) {
  if (!user) {
    return (
      <div className="flex items-center gap-4">
        <Button variant="ghost" asChild>
          <Link href="/login">Log in</Link>
        </Button>
        <Button asChild>
          <Link href="/signup">Sign up</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Button asChild>
        <a href="/org/overview">Go to Dashboard</a>
      </Button>
    </div>
  );
}
