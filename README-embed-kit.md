
# 🧬 Genealogie.app Embed Kit

This simple JavaScript kit allows any third-party website to embed the genealogie.app platform seamlessly.

---

## 🚀 Quick Start

Add the following to your webpage:

```html
<div id="genealogie-app"></div>
<script src="https://genealogie.app/embed.js"></script>
```

That's it — the iframe is automatically injected with the app.

---

## 📦 What It Does

- Loads an iframe from `https://genealogie.app/embed`
- Automatically resizes the iframe based on content height using `postMessage`
- Enables fullscreen embedding
- Requires no additional setup

---

## 🧩 Advanced Usage

To target a different container or control the embed manually:

```html
<div id="my-custom-container"></div>
<script src="https://genealogie.app/embed.js"></script>
<script>
  GenealogieEmbed.load("my-custom-container");
</script>
```

---

## 📐 Styling

The iframe will expand to `100%` width and height. You can constrain it with CSS as needed:

```css
#genealogie-app {
  max-width: 800px;
  height: 600px;
}
```

---

## 🛡️ Security Note

The embed listens to messages only from `https://genealogie.app`. Ensure your iframe src uses this origin.

---

## 📎 License

MIT
