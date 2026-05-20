/**
 * Robustly converts a string into a URL-safe slug.
 * Removes special characters and replaces spaces with hyphens.
 */
export const slugify = (text: string | null | undefined): string => {
  if (!text) return "";

  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // Replace all non-alphanumeric chars with -
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
};

/**
 * Converts a slug into a human-readable string.
 * @param text - The slug to convert
 * @returns The human-readable string
 */
export const unSlugify = (text: string | null | undefined): string => {
  if (!text) return "";

  return text
    .toString()
    .trim()
    .replace(/-/g, " ") // replace - with space
    .replace(/  +/g, " ") // replace multiple spaces with single space
    .replace(/^-+/, "") // trim - from start of text
    .replace(/-+$/, ""); // trim - from end of text
};