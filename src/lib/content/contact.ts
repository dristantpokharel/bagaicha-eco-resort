/** Link helpers for contact details stored as plain text in BusinessInfo. */

export const digitsOnly = (value: string) => value.replace(/\D/g, "");

export const telHref = (phone: string) => `tel:+${digitsOnly(phone)}`;
export const mailHref = (email: string) => `mailto:${email}`;
export const whatsappHref = (number: string) => `https://wa.me/${digitsOnly(number)}`;

/** "9779851081502" → "+977 9851081502" for display. */
export function formatWhatsapp(number: string) {
  const d = digitsOnly(number);
  return d.startsWith("977") ? `+977 ${d.slice(3)}` : `+${d}`;
}

/** "@bagaichaecoresort" from an Instagram URL. */
export function instagramHandle(url: string) {
  try {
    const first = new URL(url).pathname.split("/").filter(Boolean)[0];
    return first ? `@${first}` : url;
  } catch {
    return url;
  }
}
