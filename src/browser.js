// Where Deq is running, and how to get out of a social app's built-in browser.
//
// Cards are saved in the browser's own storage. Inside Instagram's (or TikTok's,
// LinkedIn's…) built-in browser that storage belongs to Instagram and is easily lost,
// and the camera often doesn't work there. So we try hard to move people to their
// real browser before they add anyone.

const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent

const IN_APP = [
  ['Instagram', /Instagram/i],
  ['Facebook', /FBAN|FBAV|FB_IAB|FBIOS/i],
  ['Threads', /Barcelona/i],
  ['LinkedIn', /LinkedInApp/i],
  ['TikTok', /musical_ly|BytedanceWebview|TikTok/i],
  ['Snapchat', /Snapchat/i],
  ['X', /Twitter/i],
  ['LINE', /\bLine\//i],
]

// The app's name ("Instagram"), or null in a normal browser.
export function inAppBrowser() {
  for (const [name, pattern] of IN_APP) if (pattern.test(ua)) return name
  return null
}

export const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
export const isAndroid = /Android/i.test(ua)

// Opened from the Home Screen icon (installed), not a browser tab.
export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
}

// Android lets a page hand itself to the default browser with an intent link, and
// Instagram, Facebook and Threads follow it. iPhone has no equivalent: Apple and the
// apps block it, so there we show instructions instead.
export function escapeToBrowser() {
  if (!isAndroid) return false
  const here = window.location
  const fallback = encodeURIComponent(here.href)
  here.href = `intent://${here.host}${here.pathname}${here.search}#Intent;scheme=https;S.browser_fallback_url=${fallback};end`
  return true
}

// Remember choices for this visit (sessionStorage) or for good (localStorage);
// private browsing can refuse both, which just means we ask again.
export function remember(key, value, forGood = false) {
  try {
    ;(forGood ? localStorage : sessionStorage).setItem(key, value)
  } catch {
    // not remembered: harmless
  }
}

export function recall(key, forGood = false) {
  try {
    return (forGood ? localStorage : sessionStorage).getItem(key)
  } catch {
    return null
  }
}
