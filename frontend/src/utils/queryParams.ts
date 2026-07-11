/**
 * Utility for building clean, consistent query parameter objects for API calls.
 *
 * Solves three scalability problems found across the codebase:
 * 1. Manual field-by-field spread with undefined checks
 * 2. camelCase → snake_case key mapping boilerplate
 * 3. Inconsistent handling of falsy/nil values
 *
 * @example
 * ```ts
 * // Before (manual, verbose, error-prone):
 * params: {
 *   ...(filters?.query !== undefined ? { query: filters.query } : undefined),
 *   ...(filters?.hr_decision !== undefined ? { hr_decision: filters.hr_decision } : undefined),
 *   // ...12 more lines
 * }
 *
 * // After (clean, scalable):
 * params: buildQueryParams({ skip, limit, ...filters })
 * ```
 */

/**
 * Options for configuring the behavior of `buildQueryParams`.
 */
export interface BuildQueryParamsOptions {
  /**
   * Whether to convert camelCase keys to snake_case.
   * @default true
   */
  convertKeys?: boolean;

  /**
   * Whether to strip empty strings from the output.
   * When `true` (default), keys with `""` values are removed.
   * @default true
   */
  stripEmptyStrings?: boolean;

  /**
   * Per-key value transformers. The key should match the **input** key name
   * (before any snake_case conversion). The transform function receives the
   * non-nil value and should return the transformed value.
   *
   * @example
   * ```ts
   * buildQueryParams(
   *   { result: ["Approved", "Rejected"] },
   *   { transforms: { result: (v) => v.map((r: string) => r.replace(/ed$/, "")) } }
   * )
   * // => { result: ["Approv", "Reject"] }
   * ```
   */
  transforms?: Record<string, (value: any) => any>;
}

/**
 * Converts a camelCase or PascalCase string to snake_case.
 * Already-snake_case strings pass through unchanged.
 *
 * @param str - The string to convert
 * @returns The snake_case version of the string
 *
 * @example
 * camelToSnakeCase("departmentId")   // "department_id"
 * camelToSnakeCase("hr_decision")    // "hr_decision" (no change)
 * camelToSnakeCase("jdVersions")     // "jd_versions"
 * camelToSnakeCase("testEmailSent")  // "test_email_sent"
 */
export function camelToSnakeCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

/**
 * Checks if a value should be considered "empty" and excluded from params.
 *
 * @param value - The value to check
 * @param stripEmptyStrings - Whether to treat `""` as empty
 * @returns `true` if the value should be stripped
 */
function isEmpty(value: unknown, stripEmptyStrings: boolean): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (stripEmptyStrings && value === "") {
    return true;
  }
  return false;
}

/**
 * Builds a clean query parameter object from a raw params input.
 *
 * - Strips `undefined`, `null`, and optionally `""` values
 * - Converts camelCase keys to snake_case (configurable)
 * - Applies per-key value transformations
 * - Preserves arrays and non-nil falsy values like `false` and `0`
 *
 * @param params - Raw parameter object. All nil/empty values will be stripped.
 * @param options - Configuration options for key conversion, stripping, and transforms.
 * @returns A clean `Record<string, any>` ready for use as Axios `params`.
 *
 * @example
 * ```ts
 * // Basic usage — strips nil/empty, converts keys
 * buildQueryParams({ departmentId: "abc", status: undefined, q: "" })
 * // => { department_id: "abc" }
 *
 * // With pagination and filters
 * buildQueryParams({ skip: 0, limit: 10, hrDecision: ["Approved"], startDate: new Date() })
 * // => { skip: 0, limit: 10, hr_decision: ["Approved"], start_date: <Date> }
 *
 * // Preserving falsy values (0, false are kept)
 * buildQueryParams({ testEmailSent: false, hrScore: 0 })
 * // => { test_email_sent: false, hr_score: 0 }
 *
 * // With value transform
 * buildQueryParams(
 *   { result: ["Approved", "Rejected"] },
 *   { transforms: { result: (v) => v.map((r: string) => r.replace(/ed$/, "")) } }
 * )
 * // => { result: ["Approv", "Reject"] }
 *
 * // Opt out of key conversion
 * buildQueryParams({ already_snake: "val" }, { convertKeys: false })
 * // => { already_snake: "val" }
 * ```
 */
export function buildQueryParams(
  params: Record<string, any> | undefined | null,
  options: BuildQueryParamsOptions = {},
): Record<string, any> {
  if (!params) {
    return {};
  }

  const {
    convertKeys = true,
    stripEmptyStrings = true,
    transforms = {},
  } = options;

  const result: Record<string, any> = {};

  for (const [key, rawValue] of Object.entries(params)) {
    // Skip empty values
    if (isEmpty(rawValue, stripEmptyStrings)) {
      continue;
    }

    // Apply per-key transform if defined
    const value = key in transforms ? transforms[key](rawValue) : rawValue;

    // Re-check after transform (transform could return nil)
    if (isEmpty(value, stripEmptyStrings)) {
      continue;
    }

    // Convert key if needed
    const outputKey = convertKeys ? camelToSnakeCase(key) : key;

    result[outputKey] = value;
  }

  return result;
}
