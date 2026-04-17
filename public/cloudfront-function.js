function handler(event) {
    var request = event.request;
    var uri = request.uri;
    
    // 检查是否以斜杠结尾（除了根路径）
    if (uri !== '/' && uri.endsWith('/')) {
        // 移除尾部斜杠并重定向
        var newUri = uri.slice(0, -1);
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: {
                'location': {
                    value: newUri
                },
                'cache-control': {
                    value: 'max-age=3600'
                }
            }
        };
    }
    
    // Redirect /index.html to / (canonical homepage URL)
    if (uri === '/index.html') {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: {
                'location': {
                    value: '/'
                },
                'cache-control': {
                    value: 'max-age=3600'
                }
            }
        };
    }

    // 检查是否是文件请求
    if (uri.includes('.')) {
        return request;
    }

    // Serve pre-rendered HTML for bots requesting article pages.
    // Bots don't execute JS, so the SPA won't render content for them.
    // Routes to static prerender files (build-time) or /seo Lambda (real-time).
    // Amplify rewrite rules proxy /prerender/* to the /seo Lambda for dynamic rendering.
    var ua = (request.headers['user-agent'] && request.headers['user-agent'].value || '').toLowerCase();
    var botTokens = ['bot', 'crawl', 'spider', 'slurp', 'facebookexternalhit', 'linkedinbot', 'twitterbot', 'whatsapp', 'telegram', 'discord', 'preview', 'embedly', 'quora', 'pinterest', 'redditbot', 'applebot'];
    var isBot = false;
    for (var i = 0; i < botTokens.length; i++) {
        if (ua.indexOf(botTokens[i]) !== -1) { isBot = true; break; }
    }
    if (isBot) {
        var prefix = '';
        if (uri.indexOf('/insights/') === 0) prefix = '/insights/';
        else if (uri.indexOf('/news/') === 0) prefix = '/news/';
        else if (uri.indexOf('/products/') === 0) prefix = '/products/';
        if (prefix) {
            var slug = uri.slice(prefix.length);
            if (slug && slug.indexOf('/') === -1) {
                request.uri = '/prerender' + prefix + slug + '.html';
                return request;
            }
        }
    }

    // 对于SPA路由，返回index.html
    request.uri = '/index.html';
    return request;
} 