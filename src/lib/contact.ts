/**
 * How to reach the developer — one source for every surface that prints it:
 * the contact page, the login footer, the profile header and the privacy
 * policy's contact section. Four copies of an address is four chances for
 * one of them to go stale.
 *
 * The WhatsApp numbers are `wa.me` deep links in international format:
 * digits only, no `+`, no spaces — anything else opens a chat that does not
 * exist. `display` keeps the spacing a person would dial; `href` is what a
 * phone actually opens.
 */
export const CONTACT = {
  email: "contact.lovebuild@gmail.com",
  whatsapp: [
    { display: "+234 818 579 0298", href: "https://wa.me/2348185790298" },
    { display: "+234 810 737 1352", href: "https://wa.me/2348107371352" },
  ],
} as const;
