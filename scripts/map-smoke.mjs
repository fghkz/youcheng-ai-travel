const tabs = await (await fetch("http://127.0.0.1:9223/json")).json();
const tab = tabs.find((item) => item.type === "page" && item.url.startsWith("http://localhost:3000"));
if (!tab) throw new Error("没有找到本地预览页面");

const socket = new WebSocket(tab.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 0;
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const handler = pending.get(message.id);
  if (!handler) return;
  pending.delete(message.id);
  if (message.error) handler.reject(new Error(message.error.message));
  else handler.resolve(message.result);
};
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});

function send(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}

await send("Runtime.enable");
await send("Page.enable");
await send("Page.reload", { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 2500));
await evaluate(`(async () => {
  document.querySelector('button[aria-label="在地图上选择目的地"]')?.click();
  await new Promise(resolve => setTimeout(resolve, 6500));
  return true;
})()`);

const loaded = await evaluate(`(() => {
  const canvas = document.querySelector('.map-picker-canvas');
  const rect = canvas?.getBoundingClientRect();
  return {
    dialog: Boolean(document.querySelector('.map-picker-modal')),
    sdk: Boolean(window.AMap),
    mapRendered: Boolean(canvas?.querySelector('.amap-maps')),
    errorText: document.querySelector('.map-selection small')?.textContent ?? '',
    rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
  };
})()`);
if (!loaded.dialog || !loaded.sdk || !loaded.mapRendered || !loaded.rect) throw new Error(`地图加载失败：${JSON.stringify(loaded)}`);

await evaluate(`(async () => {
  document.querySelector('.map-picker-search button')?.click();
  await new Promise(resolve => setTimeout(resolve, 2200));
  return true;
})()`);
const searched = await evaluate(`(() => ({
  label: document.querySelector('.map-selection b')?.textContent ?? '',
  address: document.querySelector('.map-selection small')?.textContent ?? '',
  confirmEnabled: !document.querySelector('.map-confirm')?.disabled,
}))()`);

const x = loaded.rect.x + loaded.rect.width * 0.58;
const y = loaded.rect.y + loaded.rect.height * 0.52;
await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
await new Promise((resolve) => setTimeout(resolve, 2500));

const selected = await evaluate(`(() => ({
  label: document.querySelector('.map-selection b')?.textContent ?? '',
  address: document.querySelector('.map-selection small')?.textContent ?? '',
  confirmEnabled: !document.querySelector('.map-confirm')?.disabled,
}))()`);
socket.close();
console.log(JSON.stringify({ loaded: { dialog: loaded.dialog, sdk: loaded.sdk, mapRendered: loaded.mapRendered }, searched, selected }));
if (!searched.confirmEnabled || !searched.label || !selected.confirmEnabled || !selected.label) process.exitCode = 1;
