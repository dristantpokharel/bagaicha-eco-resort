/** Page container for the booking and enquiry pages; the site layout provides header, main and footer. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return <div className="container-page w-full py-8 sm:py-12">{children}</div>;
}
