/**
 * Phase 1.5 design preview — the single content source for /preview.
 * In Phase 5 this is replaced by the database (BusinessInfo, rooms, activities…).
 *
 * Every string comes from docs/Brochure.pdf, docs/design.md or the owner's answers.
 * Anything not yet provided is a `placeholder` and renders with a visible DEV PLACEHOLDER badge.
 * Photos live in public/preview/ (gitignored, created by `npm run preview:photos`).
 */
import { SITE } from "@/config/site";

const photo = (file: string) => `/preview/${file}`;

export const business = {
  name: SITE.name,
  tagline: SITE.tagline,
  intro: SITE.description,
  address: "Khairi, Gulariya-3, Bardiya, Nepal",
  phone: { display: "+977 9747932458", href: "tel:+9779747932458" },
  whatsapp: { display: "+977 9851081502", href: "https://wa.me/9779851081502" },
  email: { display: "bagaichaecoresort@gmail.com", href: "mailto:bagaichaecoresort@gmail.com" },
  instagram: { display: "@bagaichaecoresort", href: "https://www.instagram.com/bagaichaecoresort/" },
  // Link printed on the brochure QR code (a qr.codes short link). Placeholder until
  // the owner confirms a direct Google Maps link for the resort.
  directions: {
    href: "https://qr.codes/3pb4MX",
    placeholder: "Confirm direct Google Maps link (currently the brochure QR short link)",
  },
} as const;

export const nav = [
  { label: "Home", href: "#top" },
  { label: "Stay", href: "#stay" },
  { label: "Dine", href: "#pillars" },
  { label: "Explore", href: "#explore" },
  { label: "Events", href: "#events" },
  { label: "Location", href: "#location" },
] as const;

/** Booking flow arrives in Phase 3; until then CTAs point at the contact details. */
export const bookingHref = "#contact";

export const hero = {
  desktop: { src: photo("hero.jpg"), width: 1432, height: 910 },
  mobile: { src: photo("hero-2.jpg"), width: 1420, height: 942 },
  alt: "Grass paths leading across the lawn to the cottages at Bagaicha Eco Resort",
};

/** Brochure cover strip */
export const highlights = [
  { icon: "leaf", label: "Peaceful surroundings" },
  { icon: "bed", label: "Comfortable stays" },
  { icon: "food", label: "Local food" },
  { icon: "people", label: "Memorable events" },
] as const;

export const intro = {
  kicker: ["Relax", "Reconnect", "Belong"],
  // Brochure p2, first sentence
  body: "Bagaicha Eco Resort is a peaceful retreat in the heart of Bardiya, where modern comfort meets nature.",
};

export const pillars = [
  {
    word: "Stay",
    line: "Quiet, comfortable stays surrounded by nature.",
    href: "#stay",
    image: { src: photo("room.jpg"), alt: "Double room with a wooden bed, warm walls and a balcony door" },
  },
  {
    word: "Dine",
    line: "Local flavours, rooted in culture.",
    href: "#pillars",
    image: { src: photo("Food.jpg"), alt: "Plates of local food on a wooden table in the garden" },
  },
  {
    word: "Explore",
    line: "Village walks, birdwatching, pickleball and more.",
    href: "#explore",
    image: { src: photo("Chill-pool.jpg"), alt: "Guests relaxing in the round chill pool at sunset among palm trees" },
  },
  {
    word: "Celebrate",
    line: "Celebrate surrounded by nature.",
    href: "#events",
    image: { src: photo("lawn.jpg"), alt: "Paved paths across the open lawn towards the cottages" },
  },
] as const;

export const about = {
  strong: "Surrounded by greenery",
  soft: "and open skies",
  // Brochure p2, rest of the paragraph
  body: "It’s a place to slow down, reconnect, and enjoy a quiet escape. Wake up to birdsong, fresh air, and the beauty of nature.",
  quote: "Wake up to birdsong, fresh air and a quieter way to stay.",
  images: {
    main: { src: photo("garden.jpg"), alt: "Garden paths, palm trees and a thatched shelter between the cottages" },
    second: { src: photo("cottages.jpg"), alt: "White cottage with a shaded veranda beside the lawn" },
    third: { src: photo("hero-2.jpg"), alt: "A row of low white cottages across a wide lawn" },
  },
  amenities: [
    { icon: "bed", label: "Comfortable rooms" },
    { icon: "wifi", label: "Modern amenities" },
    { icon: "leaf", label: "Clean, peaceful spaces" },
    { icon: "sun", label: "Surrounded by nature" },
    { icon: "people", label: "Perfect for families & groups" },
  ],
} as const;

export const rooms = {
  kicker: ["Relax", "Reconnect", "Belong"],
  headingLead: "a",
  headingAccent: "stay",
  headingSoft: "closer to nature",
  line: "Quiet, comfortable stays surrounded by nature.",
  overlay: { title: "Rooms", body: "Quiet, comfortable and surrounded by nature for a peaceful stay." },
  placeholder: "Room types, counts, amenities and rates — owner to provide before Phase 3",
  main: { src: photo("room.jpg"), alt: "Double room with a wooden bed, wall lights and a balcony door" },
  details: [
    { src: photo("bed-close-up.jpg"), alt: "Close-up of white pillows and fresh bedding" },
    { src: photo("curtains.jpg"), alt: "Patterned curtains framing a balcony door onto greenery" },
    { src: photo("towel.jpg"), alt: "Rolled towel embroidered with the Bagaicha name, on a bed" },
  ],
} as const;

export const activities = {
  kicker: ["Taste", "Explore", "Enjoy"],
  strong: "Slow down,",
  soft: "explore the outdoors",
  line: "Village walks, birdwatching, pickleball and more.",
  image: { src: photo("Chill-pool.jpg"), alt: "Guests relaxing in the round chill pool at sunset among palm trees" },
  items: [
    { name: "Village Walks", body: null, placeholder: "Village walk details — owner to provide" },
    { name: "Birdwatching", body: "Discover local birdlife.", placeholder: "Birdwatching details — owner to provide" },
    { name: "Pickleball", body: null, placeholder: "Pickleball details — owner to provide" },
    {
      name: "Outdoor Relaxation",
      body: "Slow down and explore the outdoors.",
      placeholder: "Outdoor relaxation details — owner to provide",
    },
    {
      name: "Chill Pool",
      body: "Take a refreshing dip, relax in the nature and enjoy food and drinks by the pool.",
      placeholder: null,
    },
  ],
} as const;

export const events = {
  kicker: ["Gather", "Celebrate", "Remember"],
  strong: "Weddings & Events",
  soft: "Celebrate surrounded by nature.",
  body: "Celebrate life’s special moments surrounded by nature. With beautiful gardens, open spaces and a relaxed atmosphere, Bagaicha is a welcoming setting for weddings, celebrations and gatherings.",
  image: {
    src: photo("wedding-mock.jpg"),
    alt: "Mockup of a wedding mandap with draped chairs on a garden lawn",
    placeholder: "Mockup image — not a real Bagaicha event. Replace with real event photography.",
  },
  types: [
    { icon: "rings", label: "Weddings" },
    { icon: "cake", label: "Birthdays & Celebrations" },
    { icon: "glasses", label: "Private Gatherings" },
  ],
  conferences: {
    strong: "Conferences & Trainings",
    body: "A comfortable space for meetings, trainings and group gatherings, designed for focused and productive sessions.",
    image: {
      src: photo("conference-room.jpg"),
      alt: "Conference room set up with long tables and chairs in a U shape",
    },
    uses: [
      { icon: "people", label: "Meetings" },
      { icon: "presentation", label: "Trainings" },
      { icon: "group", label: "Group gatherings" },
      { icon: "team", label: "Team sessions" },
    ],
  },
} as const;

export const location = {
  // Brochure p4
  body: "Set amid the greenery of Gulariya, Bagaicha is a peaceful retreat in the heart of Bardiya. Its relaxed garden setting offers a quiet escape while keeping you within easy reach of the region’s natural and cultural highlights.",
  map: {
    src: photo("Bagaicha-MAP.png"),
    alt: "Illustrated map of the area around Bagaicha Eco Resort, showing Krishnasaar Conservation Area, Thakurdwara and Bardiya National Park, Karnali Bridge and Nepalgunj",
  },
  qr: { src: photo("location-QR-code.png"), alt: "QR code that opens directions to Bagaicha Eco Resort" },
  // Distances from brochure p4. Where the brochure list and map disagree, the value is a placeholder.
  nearby: [
    {
      icon: "plane",
      name: "Nepalgunj",
      distance: "~41 km",
      time: "53 mins",
      placeholder: "Unconfirmed: brochure list says ~41 km, map says ~40 km",
    },
    {
      icon: "conservation",
      name: "Blackbuck / Krishnasaar Conservation Area",
      distance: "~5 km",
      time: "10 mins",
      placeholder: "Unconfirmed: brochure list says 10 mins, map says 10–15 min",
    },
    {
      icon: "park",
      name: "Bardiya National Park / Thakurdwara",
      distance: "~30 km",
      time: "50 mins",
      placeholder: null,
    },
    { icon: "bridge", name: "Karnali Bridge", distance: "~53 km", time: "75 mins", placeholder: null },
  ],
} as const;
