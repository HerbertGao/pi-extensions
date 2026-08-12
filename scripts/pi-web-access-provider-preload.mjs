const originalFetch = globalThis.fetch
const marker = process.env.PI_WEB_ACCESS_JINA_MARKER

if (!marker) throw new Error("PI_WEB_ACCESS_JINA_MARKER is required")

const mockFetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input))
  if (url.hostname === "html.duckduckgo.com") {
    const target = encodeURIComponent("https://example.com/duckduckgo-smoke")
    return new Response(
      `<html><body><div class="result"><a class="result__a" href="/l/?uddg=${target}">DuckDuckGo Smoke</a><div class="result__snippet">DuckDuckGo provider marker</div></div></body></html>`,
      { headers: { "content-type": "text/html" } },
    )
  }
  if (url.hostname === "s.jina.ai") {
    return Response.json({
      code: 200,
      data: [
        {
          title: "Jina Smoke",
          url: "https://example.com/jina-smoke",
          description: "Jina provider marker",
          content: marker,
        },
      ],
    })
  }
  return originalFetch(input, init)
}

Object.defineProperty(globalThis, "fetch", {
  configurable: true,
  get: () => mockFetch,
  set: () => {},
})
