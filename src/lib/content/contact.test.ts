import { describe, expect, it } from "vitest";
import { formatWhatsapp, instagramHandle, mailHref, telHref, whatsappHref } from "./contact";

describe("contact links", () => {
  it("builds tel and wa.me links from display numbers", () => {
    expect(telHref("+977 9747932458")).toBe("tel:+9779747932458");
    expect(whatsappHref("9779851081502")).toBe("https://wa.me/9779851081502");
    expect(whatsappHref("+977 985-1081502")).toBe("https://wa.me/9779851081502");
  });

  it("formats a WhatsApp number for display", () => {
    expect(formatWhatsapp("9779851081502")).toBe("+977 9851081502");
    expect(formatWhatsapp("14155550123")).toBe("+14155550123");
  });

  it("builds mailto links and Instagram handles", () => {
    expect(mailHref("a@b.com")).toBe("mailto:a@b.com");
    expect(instagramHandle("https://www.instagram.com/bagaichaecoresort/")).toBe("@bagaichaecoresort");
    expect(instagramHandle("not a url")).toBe("not a url");
  });
});
