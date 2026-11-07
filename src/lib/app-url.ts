// Absolute URLs for links Roadwise hands to people and agents outside the browser.
// Production uses the stable production domain; local dev uses localhost.

export function appUrl(path = "") {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return `${host ? `https://${host}` : "http://localhost:3000"}${path}`;
}
