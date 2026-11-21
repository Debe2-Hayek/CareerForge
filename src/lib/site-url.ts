export const DEFAULT_SITE_ORIGIN = "https://careerforge-phi.vercel.app";

export function resolveSiteOrigin(value = process.env.NEXT_PUBLIC_SITE_URL) {
  const candidate = value?.trim() || DEFAULT_SITE_ORIGIN;
  try {
    const url = new URL(candidate);
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.pathname !== "/"
      || url.search
      || url.hash
    ) return DEFAULT_SITE_ORIGIN;
    return url.origin;
  } catch {
    return DEFAULT_SITE_ORIGIN;
  }
}

export const siteOrigin = resolveSiteOrigin();

export function siteUrl(path = "/") {
  return new URL(path, `${siteOrigin}/`).toString();
}
