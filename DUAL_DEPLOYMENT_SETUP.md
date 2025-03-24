
# 🔁 Dual Deployment Setup: genealogie.app & proxy.genealogie.app

This project supports **two Cloudflare Pages deployments** from a single GitHub repository:

---

## 🌐 `genealogie.app`

- **Purpose**: Direct access to the app
- **Build command**: `npm run build`
- **Public path**: `/`
- **Cloudflare output directory**: `dist`

---

## 🛰️ `proxy.genealogie.app`

- **Purpose**: Used via reverse proxy under `https://familystory.live/app`
- **Build command**: `npm run build:proxy`
- **Public path**: `/app/`
- **Cloudflare output directory**: `dist`
- **Environment Variable Required**:
  ```
  USE_APP_PREFIX=true
  ```

---

## 🛠️ Webpack config logic

```js
publicPath: process.env.USE_APP_PREFIX ? '/app/' : '/',
```

This ensures both environments are handled with one Webpack config file.

---

## ☁️ Cloudflare Worker

Deployed on `familystory.live/app*` to reverse-proxy the embedded version:

```js
export default {
  async fetch(request) {
    const url = new URL(request.url)
    const path = url.pathname.replace(/^\/app/, "") || "/"
    const targetUrl = `https://proxy.genealogie.app${path}${url.search}`

    const originResponse = await fetch(targetUrl, request)
    const headers = new Headers(originResponse.headers)
    headers.set("X-Served-By", "reverse-proxy-familystory")
    headers.delete("content-security-policy")
    headers.delete("x-frame-options")

    return new Response(originResponse.body, {
      status: originResponse.status,
      headers
    })
  }
}
```

---

## ✅ Summary

| Domain                     | Served By            | Build Command        |
|---------------------------|----------------------|----------------------|
| `https://genealogie.app`  | Cloudflare Pages     | `npm run build`      |
| `https://proxy.genealogie.app` | Cloudflare Pages | `npm run build:proxy` |
| `https://familystory.live/app` | Cloudflare Worker | proxies `proxy.genealogie.app` |

