import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, faqPageJsonLd, hotelJsonLd, serializeJsonLd, toIsoTime } from "./structured-data";
import type { Business, PublicRoomType } from "@/lib/content/queries";

const business: Business = {
  name: "Test Resort", tagline: null, intro: "Intro", address: "Somewhere", phones: ["1"], whatsapp: null, emails: [],
  instagramUrl: null, facebookUrl: null, googleMapsUrl: null, directionsUrl: null,
  checkInTime: "2:00 PM", checkOutTime: "11:30 am", latitude: 28.1, longitude: 81.6, homeAbout: null, homeDiningLine: null, homeEventsLine: null,
};
const room = (over: Partial<PublicRoomType>): PublicRoomType =>
  ({ id: "1", slug: "a", name: "A", description: null, basePriceNpr: 3000, childPricePerNightNpr: 0, maxGuests: 3, maxAdults: 2, maxChildren: null, amenities: ["Wi-Fi"], photos: [], placeholderFields: [], ...over }) as PublicRoomType;

describe("toIsoTime", () => {
  it("converts 12-hour times", () => {
    expect(toIsoTime("2:00 PM")).toBe("14:00");
    expect(toIsoTime("12:00 AM")).toBe("00:00");
    expect(toIsoTime("11:30 am")).toBe("11:30");
    expect(toIsoTime("14:15")).toBe("14:15");
  });
  it("rejects free text", () => {
    expect(toIsoTime("after lunch")).toBeNull();
    expect(toIsoTime(null)).toBeNull();
    expect(toIsoTime("13 PM")).toBeNull();
  });
});

describe("hotelJsonLd", () => {
  it("derives price range, times, geo and offers from data", () => {
    const d = hotelJsonLd(business, [room({}), room({ id: "2", name: "B", basePriceNpr: 6000, amenities: ["Wi-Fi", "Fan, TV"] })]);
    expect(d.priceRange).toBe("NPR 3,000 - 6,000");
    expect(d.checkinTime).toBe("14:00");
    expect(d.checkoutTime).toBe("11:30");
    expect(d.geo?.latitude).toBe(28.1);
    expect(d.amenityFeature?.map((a) => a.name)).toEqual(["Wi-Fi", "Fan", "TV"]);
    expect(d.makesOffer?.[1].priceSpecification.price).toBe(6000);
  });
  it("leaves out what the data does not hold", () => {
    const d = hotelJsonLd({ ...business, latitude: null, checkInTime: null }, []);
    expect(d.geo).toBeUndefined();
    expect(d.checkinTime).toBeUndefined();
    expect(d.priceRange).toBeUndefined();
    expect(d.makesOffer).toBeUndefined();
  });
});

describe("other builders", () => {
  it("numbers breadcrumbs from 1", () => {
    const b = breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Guides", path: "/guides" }]);
    expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2]);
  });
  it("returns no FAQPage for an empty list", () => expect(faqPageJsonLd([])).toBeNull());
  it("escapes < so a field cannot close the script tag", () => {
    expect(serializeJsonLd({ a: "</script>" })).not.toContain("</script>");
  });
});
