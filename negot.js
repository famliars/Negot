// negot.js (Negot - 纯粹的 MIME 签名分发器和“永不回退”的保障者)

/**
 * Negot Class: 一个高度聚焦的 Service Worker 引擎，
 * 作为纯粹的 MIME 签名分发器。其核心原则是“永不回退”，
 * 总是根据请求的 Accept 头直接提供响应，并内部强制处理通配符 '*' MIME 类型。
 * 所有其他特定的 MIME 实现都由外部（社区）贡献。
 * Negot 自身不负责路由、不处理缓存、也不发起网络请求。
 * 它只是 Service Worker 回退链的最终一环，确保总能给出 200 OK 响应。
 */
class Negot {
    /**
     * @private
     * @type {Map<string, function(Request): Promise<Response | undefined>>}
     * 存储 MIME 类型签名（即内容生成器函数）。
     */
    #mimeSignatures = new Map();

    /**
     * 构造一个新的 Negot 实例。
     * 初始化时，会强制注册一个内置的通配符 '*' 生成器，作为“永不回退”的保障。
     */
    constructor() {
        console.log('[Negot] 实例已创建。正在初始化强制的通配符生成器。');
        // Negot 的核心保证：它总是会响应，即使没有其他匹配。
        // 这个 '*' 生成器就是“永不回退”机制的体现。
        this.put('*', (request) => {
            console.warn(`[Negot] 通配符 '*' 生成器被调用，请求 URL: ${request.url}。返回 200 OK 且内容为 {"data": null} 的 JSON。`);
            return new Response(JSON.stringify({ data: null }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        });
    }

    /**
     * 注册一个 MIME 类型签名（内容生成器函数）。
     * 这些函数负责在请求的 Accept 头与提供的 mimeType 匹配时生成内容。
     *
     * @param {string} mimeType - 特定的 MIME 类型字符串（例如 'application/json', 'text/html'）。
     * 注意：通配符 '*' 保留给 Negot 内部的兜底处理，不可在此注册。
     * @param {function(Request): Promise<Response | undefined>} generatorFn - 一个异步函数，
     * 接收传入的 Request 对象。它必须返回 Promise<Response>，或 Promise<undefined> 表示无法处理。
     * @throws {Error} 如果 `mimeType` 无效，或尝试注册 '*' 生成器。
     */
put(mimeType, generatorFn) {
        if (typeof mimeType !== 'string' || !mimeType || mimeType === '*') {
            throw new Error("[Negot.put] mimeType 必须是非空字符串，且不能为 '*'。");
        }
        if (typeof generatorFn !== 'function') {
            throw new Error('[Negot.put] generatorFn 必须是一个函数。');
        }
        this.#mimeSignatures.set(mimeType, generatorFn);
        console.log(`[Negot] MIME 签名 '${mimeType}' 已注册。`);
    }

    /**
     * 根据请求的 Accept 头中**第一个**列出的 MIME 类型进行内容协商，
     * 并始终返回一个有效的 200 OK HTTP Response。
     * 此方法是 Negot 的核心，纯粹基于 MIME 类型进行响应生成，不涉及路由、缓存或网络请求。
     * 如果第一个 MIME 类型无法匹配或生成响应，则直接回退到通配符 '*' 签名。
     *
     * @param {Request} request - 传入的 HTTP Request 对象。
     * @returns {Promise<Response>} 解析为生成的 HTTP Response (始终为 200 OK)。
     */
    async negotiate(request) {
        console.log(`[Negot.negotiate] 正在进行 MIME 协商 for: ${request.url}`);

        const acceptHeader = request.headers.get('Accept') || 'application/json';
        // 仅取第一个 MIME 类型，并去除可能的 q 值等参数
        const preferredMimeType = acceptHeader.split(',')[0].trim().split(';')[0]; 

        let generatedResponse = undefined;
        const signatureFn = this.#mimeSignatures.get(preferredMimeType);

        if (signatureFn) {
            try {
                const result = await Promise.resolve(signatureFn(request));
                if (result instanceof Response) {
                    generatedResponse = result;
                    console.log(`[Negot] 成功通过首选 MIME 签名 '${preferredMimeType}' 生成响应。`);
                }
            } catch (e) {
                console.error(`[Negot] 执行签名 '${preferredMimeType}' 时出错:`, e);
                // 生成器内部错误，返回 500
                return new Response(JSON.stringify({ error: `处理签名 ${preferredMimeType} 时发生内部服务器错误` }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

// 如果首选 MIME 类型未能生成有效响应，或者根本没有匹配的签名，则回退到 '*' 签名。
        if (!(generatedResponse instanceof Response)) {
            const wildcardSignatureFn = this.#mimeSignatures.get('*');
            if (wildcardSignatureFn) {
                try {
                    generatedResponse = await Promise.resolve(wildcardSignatureFn(request));
                    console.log(`[Negot] 回退到通配符 '*' 签名。`);
                } catch (e) {
                    console.error(`[Negot] 执行通配符 '*' 签名时出错:`, e);
                    // 严重错误，返回 500
                    return new Response(JSON.stringify({ error: '通配符签名内部错误' }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            }
        }
// 最终返回一个 Response (确保永远是 200)
        if (generatedResponse instanceof Response) {
            // Negot 始终保证返回 200 OK。如果内部生成器返回了非 200，强制改为 200。
            if (generatedResponse.status !== 200) {
                 console.warn(`[Negot] 警告：MIME 签名返回了非 200 状态码 (${generatedResponse.status})。强制改为 200。`);
                 return new Response(generatedResponse.body, {
                    status: 200,
                    statusText: 'OK (Forced by Negot)',
                    headers: generatedResponse.headers
                 });
            }
            return generatedResponse;
        } else {
            // 理论上，如果 '*' 签名总是返回 Response，此分支不应触发。
            console.error(`[Negot] 致命错误：MIME 协商流程未产生有效 Response。`);
            return new Response(JSON.stringify({ error: '内部服务器错误：无法生成响应' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
}

export default Negot;
