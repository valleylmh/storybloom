export function isWeChatUserAgent(userAgent: string | null | undefined) {
  return /micromessenger|wxwork/i.test(userAgent || "");
}

export function isWeChatBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return isWeChatUserAgent(navigator.userAgent);
}
