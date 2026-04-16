import type { Metadata } from "next";
import { BlogManager } from "@/components/admin/blog-manager";

export const metadata: Metadata = {
  title: "Blog Manager",
};

export default function AdminBlogPage() {
  return <BlogManager />;
}
