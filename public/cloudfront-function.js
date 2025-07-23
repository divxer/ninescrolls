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
    
    // 检查是否是文件请求
    if (uri.includes('.')) {
        return request;
    }
    
    // 对于SPA路由，返回index.html
    request.uri = '/index.html';
    return request;
} 