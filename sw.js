const CACHE_NAME = 'medtracker-v3';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

// Install
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then(response => response || fetch(e.request))
    );
});

// Push notifications
self.addEventListener('push', (e) => {
    const options = {
        body: e.data ? e.data.text() : 'Time to check your medications!',
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now()
        },
        actions: [
            { action: 'open', title: 'Open App' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };
    
    e.waitUntil(
        self.registration.showNotification('MedTracker', options)
    );
});

// Notification click
self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    
    if (e.action === 'open' || !e.action) {
        e.waitUntil(
            clients.openWindow('/')
        );
    }
});
