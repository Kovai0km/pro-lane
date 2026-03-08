export function safePostMessage(message: any, target: string = "*") {
  if (typeof window !== "undefined" && window.postMessage) {
    window.postMessage(message, target);
  } else {
    console.warn("postMessage not available in this environment");
  }
}
