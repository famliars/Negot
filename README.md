# Negot
The Service Worker Content Negotiation Engine

**Negot** will be a lean, focused library for **Service Workers** that handles **MIME-type-driven content negotiation**. It enables dynamic response generation within the browser's "edge" environment, acting as a crucial component for client-side serverless applications.

### **Core Principles**

  * **Minimalism:** Negot does one thing and does it well: resolves responses based on MIME types.
  * **Non-Intrusive:** It doesn't dictate your Service Worker's routing, caching, or lifecycle management. It's a pure utility.
  * **Highly Extensible:** Negot provides a solid foundation that integrates seamlessly with any Service Worker pattern or library you choose.

### ***Core API***
Negot exposes only two primary methods:

Negot.register(mimeType, generatorFn)

Registers an asynchronous function (generatorFn) that produces a Response for a specific mimeType.

mimeType: A string like 'application/json', 'text/html', or the wildcard '*' for fallback.

generatorFn: An async function receiving the original Request object. It must return a Promise<Response>.

Negot.resolve(request)

Looks up and executes the most appropriate registered generatorFn based on the Accept header in the provided Request.

request: The Request object from the fetch event.

Returns a Promise<Response> if a generator is found and executed successfully, otherwise null.
