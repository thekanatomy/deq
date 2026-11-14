// deq's offline copy. Generated at build time (see vite.config.js): VERSION and ASSETS
// are filled in for each build. Online, deq.one always comes first, so new versions
// arrive as before; only when the network fails (offline, or a Wi-Fi that blocks
// deq.one) does the phone open the copy it kept. Your cards already live on the phone.
const VERSION = '__VERSION__'
const ASSETS = __ASSETS__
// newest first when sorted: the build time leads the name
const CACHE = `deq-__BUILT__-${VERSION}`
const KEEP = 3

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      // the page itself, and every file this version needs, so nothing is missing offline
      await cache.add(new Request('/', { cache: 'reload' })).catch(() => {})
      await Promise.all(ASSETS.map(file => cache.add(file).catch(() => {})))
    })(),
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      // keep the last few versions: a phone still running an older one can load its own files
      const versions = (await caches.keys()).filter(key => key.startsWith('deq-')).sort().reverse()
      for (const key of versions.slice(KEEP)) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

// the network, but no longer than this: a blocked Wi-Fi often just hangs
function fromNetwork(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('slow')), ms)
    fetch(request).then(
      response => {
        clearTimeout(timer)
        resolve(response)
      },
      error => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // maps, fonts, AI: straight to the network
  if (url.pathname.startsWith('/api/')) return // passes, contacts, scans: never from a copy
  if (url.pathname.endsWith('.mp4')) return // the intro film streams in pieces

  // opening deq: deq.one first; the kept copy only when that fails
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fromNetwork(request, 6000)
          if (response.ok) {
            const cache = await caches.open(CACHE)
            cache.put('/', response.clone())
          }
          return response
        } catch {
          return (await caches.match('/')) ?? Response.error()
        }
      })(),
    )
    return
  }

  // a version's files never change once built: the kept copy is as good as new
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const kept = await caches.match(request)
        if (kept) return kept
        const response = await fetch(request)
        if (response.ok) (await caches.open(CACHE)).put(request, response.clone())
        return response
      })(),
    )
    return
  }

  // everything else (icons, the manifest, the update check): network, then the copy
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request)
        if (response.ok && !url.search) (await caches.open(CACHE)).put(request, response.clone())
        return response
      } catch {
        return (await caches.match(request, { ignoreSearch: true })) ?? Response.error()
      }
    })(),
  )
})
