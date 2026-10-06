/**
 * Container for the booking and enquiry forms. The site layout provides header, main and
 * footer; `form-brand` (globals.css) gives the form controls the brochure look.
 */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return <div className="form-brand container-page w-full pb-10 md:pb-20">{children}</div>;
}
