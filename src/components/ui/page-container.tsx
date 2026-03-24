import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  wide?: boolean;
  className?: string;
}

export function PageContainer({ children, wide = false, className }: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full px-4 py-5 sm:px-6 md:px-8 lg:px-10", wide ? "max-w-[1400px]" : "max-w-6xl", className)}>
      {children}
    </div>
  );
}
