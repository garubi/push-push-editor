const VERSION = "1.0.2";
const CACHE_NAME = `PushPushEditor-${VERSION}`;
const PRE_CACHED_RESOURCES = [
  // "index.html", 
  // "gcommander.min.css",
  // "gcommander.min.js", 
  // "iconfont/material-icons-v140-latin-regular.woff", 
  // "iconfont/material-icons-v140-latin-regular.woff2",
  // "img/gcommander-logotext.png",
  // "img/gcommander-logo.png",
];

const expectedCaches = [CACHE_NAME]

// inspired by https://github.com/MicrosoftEdge/Demos/blob/main/pwamp/sw.js
// Add a cache-busting query string to the pre-cached resources.
// This is to avoid loading these resources from the disk cache.
const PRE_CACHED_RESOURCES_WITH_VERSIONS = PRE_CACHED_RESOURCES.map(path => {
  return `${path}?v=${VERSION}`;
});

// Use the install event to pre-cache all initial resources.
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    cache.addAll(PRE_CACHED_RESOURCES_WITH_VERSIONS);
  })());
});

// force deleting the old cache...
self.addEventListener('activate', event => {
  // delete any caches that aren't in expectedCaches
  // which will get rid of static-v1
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (!expectedCaches.includes(key)) {
          return caches.delete(key);
        }
      })
    )).then(() => {
      console.log( CACHE_NAME + ' now ready to handle fetches!');
    })
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Don't care about other-origin URLs.
  if (url.origin !== location.origin) {
    return;
  }

  // Don't care about anything else than GET.
  if (event.request.method !== 'GET') {
    return;
  }

  // Don't care about widget requests.
  if (url.pathname.includes("/widgets/")) {
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Get the resource from the cache.
    const versionedUrl = `${event.request.url}?v=${VERSION}`;
    const cachedResponse = await cache.match(versionedUrl);

    if (cachedResponse) {
      return cachedResponse;
    } else {
        try {
          // If the resource was not in the cache, try the network.
          const fetchResponse = await fetch(versionedUrl);
          // Save the resource in the cache and return it.
          cache.put(versionedUrl, fetchResponse.clone());
          return fetchResponse;
        } catch (e) {
          console.log('The network failed.');
          
        }
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    console.log('received PUSH SKIP_WAITING');
      self.skipWaiting();
  }
});