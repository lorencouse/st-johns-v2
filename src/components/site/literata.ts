import { Literata } from "next/font/google";

/**
 * The public pages (landing, legal, sign-in) are set in Literata; the
 * signed-in app keeps Geist, and product fragments on the landing use it
 * (`font-sans`) so they look like the app.
 */
export const literata = Literata({ subsets: ["latin"], display: "swap" });
