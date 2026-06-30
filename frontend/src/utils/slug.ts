/**
 * @module slug
 * Utility functions for slugifying and unslugifying text, useful for generating and parsing URL-friendly strings.
 */

/**
 * Robustly converts a string into a URL-safe slug.
 * Removes special characters and replaces spaces with hyphens.
 *
 * @param text - The input text or nullable value to slugify.
 * @returns The URL-safe slug string. Returns an empty string if input is null, undefined, or empty.
 * @example
 * ```ts
 * slugify("Hello World!") // returns "hello-world"
 * slugify("A  complex---string!!!") // returns "a-complex-string"
 * ```
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
 * Converts a slug back into a human-readable, space-separated string.
 *
 * @param text - The slug to convert back to readable text.
 * @returns The human-readable space-separated string. Returns an empty string if input is null, undefined, or empty.
 * @example
 * ```ts
 * unSlugify("hello-world") // returns "hello world"
 * unSlugify("some--multiple-spaces-slug") // returns "some multiple spaces slug"
 * ```
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