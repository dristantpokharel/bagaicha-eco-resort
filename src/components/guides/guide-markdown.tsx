import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { deliveryUrl, isCloudinaryUrl } from "@/lib/cloudinary/delivery";

const isInternal = (href: string) => href.startsWith("/") && !href.startsWith("//");

/** Markdown elements in the site's type. The page title is the h1, so body headings start at h2. */
const components: Components = {
  h1: ({ children }) => <h2 className="text-heading-strong mt-12 mb-4 text-ink-heading">{children}</h2>,
  h2: ({ children }) => <h2 className="text-heading-strong mt-12 mb-4 text-ink-heading">{children}</h2>,
  h3: ({ children }) => <h3 className="text-title mt-8 mb-3 text-ink-heading">{children}</h3>,
  h4: ({ children }) => <h3 className="text-title mt-8 mb-3 text-ink-heading">{children}</h3>,
  h5: ({ children }) => <h3 className="text-title mt-8 mb-3 text-ink-heading">{children}</h3>,
  h6: ({ children }) => <h3 className="text-title mt-8 mb-3 text-ink-heading">{children}</h3>,
  p: ({ children }) => <p className="text-body my-4">{children}</p>,
  ul: ({ children }) => <ul className="text-body my-4 list-disc space-y-2 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="text-body my-4 list-decimal space-y-2 pl-6">{children}</ol>,
  blockquote: ({ children }) => <blockquote className="my-6 border-l-2 border-forest/40 pl-5 text-ink-muted italic">{children}</blockquote>,
  hr: () => <hr className="my-10 border-forest/20" />,
  strong: ({ children }) => <strong className="font-semibold text-ink-heading">{children}</strong>,
  a: ({ href = "", children }) =>
    isInternal(href) ? (
      <Link href={href} className="underline underline-offset-4 hover:text-forest">
        {children}
      </Link>
    ) : (
      <a href={href} rel="noopener noreferrer" target="_blank" className="underline underline-offset-4 hover:text-forest">
        {children}
      </a>
    ),
  // Only Media library (Cloudinary) images are shown; any other image URL is dropped.
  img: ({ src, alt }) => {
    if (typeof src !== "string" || !isCloudinaryUrl(src)) return null;
    return (
      <span className="my-8 block">
        {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary resizes; dimensions are unknown in Markdown */}
        <img src={deliveryUrl(src, 1200)} alt={alt ?? ""} loading="lazy" className="h-auto w-full" />
      </span>
    );
  },
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-forest/30 px-3 py-2 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-forest/10 px-3 py-2">{children}</td>,
};

/** Sanitised Markdown (no raw HTML, no scripts). Used by the public post page and the admin preview. */
export function GuideMarkdown({ source }: { source: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={components}>
      {source}
    </ReactMarkdown>
  );
}
