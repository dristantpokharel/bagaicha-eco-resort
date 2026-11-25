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

export const GUIDES_NAV = { label: "Guides", href: "/guides" } as const;

export const FOOTER_NAV = [
  ...NAV,
  GUIDES_NAV,
  { label: "Gallery", href: "/gallery" },
  { label: "Contact", href: "/contact" },
  { label: "FAQ", href: "/faq" },
  { label: "Policies", href: "/policies" },
] as const;

export const HOME = {
  hero: {
    /** Small line inside the H1, under the name: where we are and what we are. */
    kicker: "Hotel and eco resort in Gulariya, Bardiya",
  },
  about: {
    strong: "Surrounded by greenery",
    soft: "and open skies",
  },
  rooms: {
    lead: "a",
    accent: "stay",
    soft: "closer to nature",
  },
  explore: {
    strong: "Slow down,",
    soft: "explore the outdoors",
  },
  events: {
    kicker: ["Gather", "Celebrate", "Remember"],
    strong: "Weddings & Events",
    soft: "Celebrate surrounded by nature.",
    body: "Celebrate life’s special moments surrounded by nature. With beautiful gardens, open spaces and a relaxed atmosphere, Bagaicha is a welcoming setting for weddings, celebrations and gatherings.",
  },
  dining: { title: "Restaurant & dining in Gulariya" },
  gatherings: { title: "Events & gatherings" },
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

/** Structure words for /krishnasaar. The page's facts and prose come from the database (Content → Krishnasaar). */
export const KRISHNASAAR = {
  path: "/krishnasaar",
  navLabel: "Krishnasaar blackbuck",
  fallbackDescription: "A guide to the Krishnasaar blackbuck near Bagaicha Eco Resort in Gulariya, Bardiya.",
  sections: {
    whatItIs: "What it is",
    history: "History and conservation",
    wildlife: "Wildlife and best season",
    gettingThere: "Getting there",
    whatToBring: "What to bring",
    nearby: "Nearby attractions",
    gallery: "Photographs",
    faq: "Questions and answers",
    guides: "Related guides",
  },
  band: { cta: "Read about Krishnasaar" },
  cta: {
    heading: "Visit Krishnasaar from Bagaicha",
    line: "Stay in Gulariya, in the heart of Bardiya, and plan your visit with us.",
    plan: "Plan your visit",
    book: "Book your stay",
  },
} as const;

/** Internal links between the main pages (anchor text carries the keywords naturally). */
export const RELATED_LINKS = {
  stay: { href: "/stay", label: "Rooms and stays in Gulariya" },
  dine: { href: "/dine", label: "Restaurant and food in Gulariya" },
  explore: { href: "/explore", label: "Things to do in Bardiya" },
  location: { href: "/location", label: "How to find us, near Bardiya National Park" },
  guides: { href: "/guides", label: "Guides for a peaceful stay in Bardiya" },
} as const;

export const PAGES = {
  guides: {
    title: "Guides",
    heading: { strong: "Guides", soft: "for visiting Bardiya" },
    line: "Planning notes and local know-how for your stay.",
    description: "Guides for planning a peaceful stay in Bardiya, from Bagaicha Eco Resort in Gulariya.",
  },
  stay: {
    title: "Hotel & Lodge Stay in Gulariya",
    heading: { strong: "A stay", soft: "closer to nature" },
    line: "Quiet, comfortable rooms for a peaceful stay in Bardiya, surrounded by nature.",
    description: "Stay at Bagaicha Eco Resort, a peaceful hotel and lodge in Gulariya, Bardiya. Comfortable rooms surrounded by nature; request your booking online.",
  },
  dine: {
    title: "Restaurant & Food in Gulariya",
    heading: { strong: "Local Flavours,", soft: "Rooted in Culture" },
    line: "Experience the flavours of Bardiya in a setting surrounded by nature, with local tastes, relaxed dining and warm hospitality.",
    description: "Restaurant and garden dining at Bagaicha Eco Resort in Gulariya, Bardiya: local flavours and warm hospitality, for food in a peaceful setting.",
  },
  explore: {
    groups: {
      AT_BAGAICHA: { heading: "At Bagaicha", line: "Things to enjoy without leaving the resort." },
      CLOSE_BY: { heading: "Close by", line: "Short visits near the resort." },
      DAY_TRIP: { heading: "Day trips", line: "We can help arrange these." },
    },
    planning: {
      heading: "Tell us your dates and interests.",
      line: "Tell us when you are coming and what you would like to see, and we will help you plan.",
    },
    title: "Things to Do in Bardiya",
    heading: { strong: "Slow down,", soft: "explore the outdoors" },
    line: "Village walks, birdwatching, pickleball and more around Gulariya and Bardiya.",
    description: "Things to do around Bagaicha Eco Resort in Gulariya, Bardiya: village walks, birdwatching, pickleball, and trips towards Bardiya National Park.",
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
    title: "Resort near Bardiya National Park",
    heading: { strong: "Our location", soft: "in Gulariya, Bardiya" },
    line: "Within easy reach of the region’s natural and cultural highlights.",
    description: "Find Bagaicha Eco Resort in Khairi, Gulariya-3, Bardiya, Nepal: a resort near Bardiya National Park and within reach of Nepalgunj, with directions.",
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
