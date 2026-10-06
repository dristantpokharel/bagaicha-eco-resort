/**
 * Editorial copy and navigation for the public site. Facts about the business
 * (phone, address, prices, distances…) are NOT here: they come from the database.
 * Wording comes from docs/design.md and docs/Brochure.pdf (see docs/design-tokens.md §8).
 */

export const BOOKING_HREF = "/book";

export const NAV = [
  { label: "Home", href: "/" },
  { label: "Stay", href: "/stay" },
  { label: "Dine", href: "/dine" },
  { label: "Explore", href: "/explore" },
  { label: "Events", href: "/events" },
  { label: "Location", href: "/location" },
] as const;

export const FOOTER_NAV = [
  ...NAV,
  { label: "Gallery", href: "/gallery" },
  { label: "Contact", href: "/contact" },
  { label: "FAQ", href: "/faq" },
  { label: "Policies", href: "/policies" },
] as const;

export const HOME = {
  highlights: [
    { icon: "leaf", label: "Peaceful surroundings" },
    { icon: "bed", label: "Comfortable stays" },
    { icon: "food", label: "Local food" },
    { icon: "people", label: "Memorable events" },
  ],
  intro: {
    kicker: ["Relax", "Reconnect", "Belong"],
    body: "Bagaicha Eco Resort is a peaceful retreat in the heart of Bardiya, where modern comfort meets nature.",
  },
  pillars: [
    { word: "Stay", line: "Quiet, comfortable stays surrounded by nature.", href: "/stay", slot: "STAY" },
    { word: "Dine", line: "Local flavours, rooted in culture.", href: "/dine", slot: "DINE" },
    { word: "Explore", line: "Village walks, birdwatching, pickleball and more.", href: "/explore", slot: "EXPLORE" },
    { word: "Celebrate", line: "Celebrate surrounded by nature.", href: "/events", slot: "EVENTS" },
  ],
  about: {
    strong: "Surrounded by greenery",
    soft: "and open skies",
    body: "It’s a place to slow down, reconnect, and enjoy a quiet escape. Wake up to birdsong, fresh air, and the beauty of nature.",
    quote: "Wake up to birdsong, fresh air and a quieter way to stay.",
    amenities: [
      { icon: "bed", label: "Comfortable rooms" },
      { icon: "wifi", label: "Modern amenities" },
      { icon: "leaf", label: "Clean, peaceful spaces" },
      { icon: "sun", label: "Surrounded by nature" },
      { icon: "people", label: "Perfect for families & groups" },
    ],
  },
  rooms: {
    kicker: ["Relax", "Reconnect", "Belong"],
    lead: "a",
    accent: "stay",
    soft: "closer to nature",
    line: "Quiet, comfortable stays surrounded by nature.",
    overlay: { title: "Rooms", body: "Quiet, comfortable and surrounded by nature for a peaceful stay." },
  },
  explore: {
    kicker: ["Taste", "Explore", "Enjoy"],
    strong: "Slow down,",
    soft: "explore the outdoors",
    line: "Village walks, birdwatching, pickleball and more.",
  },
  events: {
    kicker: ["Gather", "Celebrate", "Remember"],
    strong: "Weddings & Events",
    soft: "Celebrate surrounded by nature.",
    body: "Celebrate life’s special moments surrounded by nature. With beautiful gardens, open spaces and a relaxed atmosphere, Bagaicha is a welcoming setting for weddings, celebrations and gatherings.",
  },
  location: {
    body: "Set amid the greenery of Gulariya, Bagaicha is a peaceful retreat in the heart of Bardiya. Its relaxed garden setting offers a quiet escape while keeping you within easy reach of the region’s natural and cultural highlights.",
  },
} as const;

/** Icon for an event type, by slug (EventType has no icon column). */
export const EVENT_ICONS: Record<string, "rings" | "cake" | "glasses" | "presentation"> = {
  weddings: "rings",
  "birthdays-and-celebrations": "cake",
  "private-gatherings": "glasses",
  "conferences-and-trainings": "presentation",
};

export const PAGES = {
  stay: {
    title: "Stay",
    heading: { strong: "A stay", soft: "closer to nature" },
    line: "Quiet, comfortable stays surrounded by nature.",
    description: "Quiet, comfortable stays surrounded by nature at Bagaicha Eco Resort in Bardiya, Nepal.",
  },
  dine: {
    title: "Dine",
    heading: { strong: "Local Flavours,", soft: "Rooted in Culture" },
    line: "Experience the flavours of Bardiya in a setting surrounded by nature, with local tastes, relaxed dining and warm hospitality.",
    description: "Local flavours, garden dining and warm hospitality at Bagaicha Eco Resort in Bardiya.",
  },
  explore: {
    title: "Explore",
    heading: { strong: "Slow down,", soft: "explore the outdoors" },
    line: "Village walks, birdwatching, pickleball and more.",
    description: "Village walks, birdwatching, pickleball and outdoor relaxation at Bagaicha Eco Resort.",
  },
  events: {
    title: "Events",
    heading: { strong: "Weddings & Events", soft: "Celebrate surrounded by nature." },
    line: "Celebrate life’s special moments surrounded by nature. With beautiful gardens, open spaces and a relaxed atmosphere, Bagaicha is a welcoming setting for weddings, celebrations and gatherings.",
    description: "Weddings, celebrations, conferences and trainings at Bagaicha Eco Resort in Bardiya.",
    conference: "A comfortable space for meetings, trainings and group gatherings, designed for focused and productive sessions.",
  },
  gallery: {
    title: "Gallery",
    heading: { strong: "A look around", soft: "Bagaicha" },
    line: "Rooms, gardens, dining and events at Bagaicha Eco Resort.",
    description: "Photographs of the rooms, gardens, dining and events at Bagaicha Eco Resort.",
  },
  location: {
    title: "Location",
    heading: { strong: "Our", soft: "Location" },
    line: "Within easy reach of the region’s natural and cultural highlights.",
    description: "Find Bagaicha Eco Resort in Khairi, Gulariya-3, Bardiya, Nepal, with directions and nearby places.",
  },
  contact: {
    title: "Contact",
    heading: { strong: "Get in", soft: "touch" },
    line: "Call, message or write to us. For a stay, send a booking request.",
    description: "Contact Bagaicha Eco Resort in Bardiya, Nepal by phone, WhatsApp or email.",
  },
  faq: {
    title: "FAQ",
    heading: { strong: "Questions", soft: "and answers" },
    line: "Answers to questions guests often ask.",
    description: "Frequently asked questions about staying at Bagaicha Eco Resort.",
  },
  policies: {
    title: "Policies",
    heading: { strong: "Good to", soft: "know" },
    line: "Our policies, in one place.",
    description: "Booking, cancellation and stay policies at Bagaicha Eco Resort.",
  },
} as const;
