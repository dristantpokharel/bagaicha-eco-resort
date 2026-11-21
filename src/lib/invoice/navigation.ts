export function invoiceIssuedHref(invoiceId: string) {
  return `/admin/invoices/${encodeURIComponent(invoiceId)}?issued=1`;
}
