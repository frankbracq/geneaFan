# 🧬 Genealogie.app Embed Kit

This JavaScript kit allows third-party websites to embed the genealogie.app platform with minimal effort.

---

## 🚀 Quick Start

Add the following HTML snippet to your page:

```html
<div id="genealogie-app"></div>
<script src="https://genealogie.app/embed.js"></script>
```

The app will automatically appear inside the `#genealogie-app` container.

---

## ⚙️ What It Does

- Loads an iframe from `https://genealogie.app/embed`
- Automatically resizes the iframe based on its content
- Provides a fullscreen button inside the embed view
- Exposes a global API for advanced manual usage

---

## 📦 Manual Integration

To use a custom container ID or load dynamically:

```html
<div id="my-container"></div>
<script src="https://genealogie.app/embed.js"></script>
<script>
  GenealogieEmbed.load("my-container");
</script>
```

---

## 📐 Styling

By default, the iframe takes full width and height. You can constrain it via CSS:

```css
#genealogie-app {
  width: 100%;
  max-width: 1000px;
  height: 600px;
}
```

---

## 🧪 Security

Only accepts postMessages from `https://genealogie.app`.

---

## 📎 License

MIT