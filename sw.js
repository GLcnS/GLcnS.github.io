/**
 * GLcn Service Worker - 音乐缓存策略
 * Version: 2.2.1
 * 功能：缓存核心资源，实现零流量音乐播放
 */

const CACHE_NAME = 'glcn-music-v1';
const CORE_ASSETS = ['./', './index.html', './music.mp3', './歌词.lrc'];

// 安装阶段：预缓存核心资源
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Pre-caching core assets');
                return cache.addAll(CORE_ASSETS);
            })
            .then(() => {
                console.log('[SW] Core assets cached successfully');
                return self.skipWaiting();
            })
            .catch((err) => {
                console.warn('[SW] Pre-cache failed:', err);
                return self.skipWaiting();
            })
    );
});

// 激活阶段：清理旧缓存，接管页面
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        Promise.all([
            // 清理旧版本缓存
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            }),
            // 立即接管所有客户端
            self.clients.claim()
        ]).then(() => {
            console.log('[SW] Activated and controlling pages');
        })
    );
});

// 拦截请求：缓存优先策略（音乐文件）
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // 只处理同源请求
    if (url.origin !== self.location.origin) {
        return;
    }

    // 音乐文件和歌词文件使用缓存优先策略
    if (request.url.includes('music.mp3') || request.url.includes('歌词.lrc')) {
        event.respondWith(
            caches.match(request)
                .then((cached) => {
                    // 缓存命中，直接返回
                    if (cached) {
                        console.log('[SW] Cache hit:', url.pathname);
                        return cached;
                    }

                    // 缓存未命中，网络请求并缓存
                    return fetch(request)
                        .then((response) => {
                            // 无效响应直接返回
                            if (!response || response.status !== 200 || response.type !== 'basic') {
                                return response;
                            }

                            // 克隆响应（响应流只能读取一次）
                            const responseToCache = response.clone();

                            // 存入缓存
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(request, responseToCache);
                                    console.log('[SW] Cached:', url.pathname);
                                })
                                .catch((err) => {
                                    console.warn('[SW] Cache put failed:', err);
                                });

                            return response;
                        })
                        .catch((err) => {
                            console.error('[SW] Fetch failed:', err);
                            // 网络失败时返回缓存（如果有）
                            return cached;
                        });
                })
        );
        return;
    }

    // 其他资源使用网络优先策略
    if (request.mode === 'navigate' || request.destination === 'document') {
        event.respondWith(
            fetch(request)
                .catch(() => {
                    return caches.match(request);
                })
        );
    }
});

// 消息处理：与主页面通信
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
