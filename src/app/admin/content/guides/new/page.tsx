import { requirePagePermission } from "@/lib/auth";
import { GuideEditor } from "../guide-editor";
import { loadLibrary } from "../loaders";

export const metadata = { title: "New guide" };

export default async function NewGuidePage() {
  await requirePagePermission("content.manage");
  return (
    <GuideEditor
      library={await loadLibrary()}
      initial={{ title: "", slug: "", excerpt: "", body: "", coverMediaId: null, tags: "", authorName: "", authorRole: "", status: "DRAFT", publishedAt: "", seoTitle: "", seoDescription: "", faq: [], placeholderFields: [] }}
    />
  );
}
