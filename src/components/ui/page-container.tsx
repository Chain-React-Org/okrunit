import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  wide?: boolean;
  className?: string;
}

export function PageContainer({ children, wide = false, className }: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full px-6 py-6 md:px-8", wide ? "max-w-7xl" : "max-w-6xl", className)}>
      {children}
    </div>
  );
}
