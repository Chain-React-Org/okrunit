import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: PaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between gap-4 px-1 py-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          {startItem}-{endItem} of {totalItems}
        </span>
        <span>•</span>
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap">Per page:</span>
          <Select value={pageSize.toString()} onValueChange={(v) => onPageSizeChange(parseInt(v))}>
            <SelectTrigger className="h-8 w-16 border-0 bg-muted/40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-8 w-8"
        >
          <ChevronLeft className="size-4" />
        </Button>

        <div className="flex items-center gap-1 px-2">
          {Array.from({ length: totalPages }).map((_, i) => {
            const page = i + 1;
            const isCurrentPage = page === currentPage;
            const isNearCurrent = Math.abs(page - currentPage) <= 1;
            const isFirstOrLast = page === 1 || page === totalPages;

            if (!isNearCurrent && !isFirstOrLast) {
              // Show ellipsis
              if (page === 2 && currentPage > 3) {
                return <span key={`ellipsis-${page}`} className="px-1 text-muted-foreground">…</span>;
              }
              if (page === totalPages - 1 && currentPage < totalPages - 2) {
                return <span key={`ellipsis-${page}`} className="px-1 text-muted-foreground">…</span>;
              }
              return null;
            }

            return (
              <Button
                key={page}
                variant={isCurrentPage ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(page)}
                className={cn(
                  "h-8 w-8 px-0",
                  isCurrentPage && "pointer-events-none"
                )}
              >
                {page}
              </Button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-8 w-8"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
