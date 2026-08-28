const CACHE = 'lavajato-2';
const APP_SHELL = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first: sempre busca a versão mais nova quando há internet,
// e só usa o cache (modo offline) se a rede falhar.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// Notificações push (Firebase Cloud Messaging) para o admin, mesmo com o
// app fechado. IMPORTANTE: mantenha firebaseConfig igual ao usado no
// index.html.
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: 'sua-api-key-aqui',
  authDomain: 'seu-projeto.firebaseapp.com',
  projectId: 'seu-projeto',
  storageBucket: 'seu-projeto.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:xxxxxxxxxxxxxxxxxxxxxx',
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging.isSupported() ? firebase.messaging() : null;
  if (messaging) {
    messaging.onBackgroundMessage((payload) => {
      const { title, body } = payload.notification || {};
      self.registration.showNotification(title || 'Brilho Total', {
        body: body || 'Novo agendamento.',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
      });
    });
  }
} catch (err) {
  // Config ainda com placeholder, ou Cloud Messaging indisponível neste navegador.
}
