import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="force-light flex min-h-svh flex-col items-center justify-center bg-white px-4 py-6 sm:px-6 sm:py-10 text-zinc-950">
      <div className="mb-4 sm:mb-8">
        <Image src="/logo_text.webp" alt="OKrunit" width={140} height={105} priority className="sm:w-[180px] sm:h-auto" />
      </div>

      <div className="w-full max-w-sm">{children}</div>

      <p className="mt-4 sm:mt-8 text-xs text-zinc-400">
        Human-in-the-loop approval for every automation.
      </p>
    </div>
  );
}
