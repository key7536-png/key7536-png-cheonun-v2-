// 여명당 상담도구 앱 설치용 서비스워커: 항상 최신 화면을 쓰도록 저장(캐시)하지 않고 그대로 인터넷에서 받는다.
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{});
