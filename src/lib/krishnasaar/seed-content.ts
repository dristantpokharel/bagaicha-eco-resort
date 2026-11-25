/**
 * Starter text for /krishnasaar. Structure and plain guidance only: no counts, areas, dates, names
 * of people or places, or distances. Every field is flagged "verify", so in production the page stays
 * hidden until the owner has reviewed it (see docs/krishnasaar-verify.md for what to confirm).
 */

export const KRISHNASAAR_SEED = {
  title: "Krishnasaar",
  intro: "An introduction to the Krishnasaar and how to plan a visit while you stay with us.",
  whatItIs:
    "This section introduces the Krishnasaar: what it is, how to recognise it and why it matters to the area.\n\nIt is written for guests who have never seen one and would like to know what to expect before they go.",
  history:
    "This section explains the story of the Krishnasaar in the region and the work that protects it today.\n\nIt covers how the protected area came about, who looks after it and how visitors can help.",
  wildlife:
    "This section describes the wildlife you may see on a visit and when different animals are easiest to spot.\n\nSightings can never be promised, so it also explains how to give yourself the best chance.",
  bestTime:
    "This section describes the best seasons to visit, what each season is like and what to wear.\n\nIf you are unsure about your dates, send us an enquiry and we will help you choose.",
  gettingThere:
    "This section explains how to reach the Krishnasaar from the resort and what the journey is like.\n\nAsk us to help arrange transport and a guide.",
  whatToBring:
    "This section lists what to bring: suitable clothing and shoes, sun and insect protection, water, a camera and binoculars if you have them.\n\nIt also reminds visitors to keep quiet and keep a respectful distance from the animals.",
  relatedGuides: ["krishnasaar-blackbuck-a-visitors-guide"],
} as const;

export const KRISHNASAAR_FAQS = [
  { question: "What is the best time to visit?", answer: "This answer will explain the best seasons. Meanwhile, tell us your dates and we will advise you." },
  { question: "How do I get there from the resort?", answer: "This answer will explain the route and journey. We can help arrange transport and a guide." },
  { question: "Do I need a guide or a permit?", answer: "This answer will explain any permits and guide arrangements. Ask us and we will confirm for your visit." },
  { question: "What should I bring?", answer: "This answer will list what to bring. See the section above and ask us if you are unsure." },
  { question: "Can children visit?", answer: "This answer will explain what to expect with children. Contact us to plan a visit that suits your family." },
] as const;

/** Every text field that carries a claim starts flagged. */
export const KRISHNASAAR_FLAGGED = ["title", "intro", "whatItIs", "history", "wildlife", "bestTime", "gettingThere", "whatToBring"] as const;
