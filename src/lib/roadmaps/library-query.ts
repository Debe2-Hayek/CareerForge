const names = ["q", "area", "topic", "level", "type", "page"] as const;

/** Keeps only known, short, single-valued filters from the URL. */
export function readLibraryQuery(search: Record<string, string | string[] | undefined>): Partial<Record<(typeof names)[number], string>> {
  return Object.fromEntries(names.flatMap(name => {
    const value = search[name];
    return typeof value === "string" && value.trim() && value.length <= 60 ? [[name, value.trim()]] : [];
  }));
}
