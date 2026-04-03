import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="force-light flex min-h-svh flex-col items-center justify-center bg-white px-6 py-12 text-zinc-950">
      <div className="mb-8">
        <Image src="/logo_text.png" alt="OKrunit" width={180} height={135} />
      </div>

      <div className="w-full max-w-sm">{children}</div>

      <p className="mt-8 text-xs text-zinc-400">
        Human-in-the-loop approval for every automation.
      </p>
    </div>
  );
}
