// Remembers where the user was when their session ended (e.g. the API restarted and
// dropped the in-memory key) so signing in takes them back there instead of /servers.
const KEY = 'lp_return_to'

export function rememberReturnTo(path: string) {
  try {
    sessionStorage.setItem(KEY, path)
  } catch {
    /* storage unavailable — fall back to the default page */
  }
}

export function takeReturnTo(fallback = '/servers') {
  try {
    const path = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    // Only same-origin app paths; never auth pages or protocol-relative URLs.
    if (path && path.startsWith('/') && !path.startsWith('//') && !/^\/(login|setup)\b/.test(path)) return path
  } catch {
    /* ignore */
  }
  return fallback
}
