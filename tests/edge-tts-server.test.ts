import { afterEach, describe, expect, it } from "vitest";
import { WebSocketServer } from "ws";
import {
  createEdgeTtsSsml,
  generateSecMsGec,
  normalizeEdgeTtsText,
  parseEdgeTtsBinaryFrame,
  synthesizeEdgeTtsAudio,
} from "@/lib/edge-tts-server";

afterEach(() => {
  delete process.env.EDGE_TTS_WEBSOCKET_URL;
  delete process.env.EDGE_TTS_MAX_ATTEMPTS;
  delete process.env.EDGE_TTS_TIMEOUT_MS;
});

function createAudioFrame(audio: Buffer) {
  const headers = Buffer.from(
    "X-RequestId:test\r\nContent-Type:audio/mpeg\r\nPath:audio\r\n",
    "utf8",
  );
  const prefix = Buffer.alloc(2);
  prefix.writeUInt16BE(headers.length);
  return Buffer.concat([prefix, headers, audio]);
}

describe("Edge TTS protocol helpers", () => {
  it("matches the current Edge DRM token algorithm", () => {
    expect(generateSecMsGec(1_720_000_000)).toBe(
      "9E0411A29988AC95A0424E92611537B75A204A79E1E702A15969997497CCB404",
    );
  });

  it("normalizes controls and escapes narration inside SSML", () => {
    const normalized = normalizeEdgeTtsText("  星\u200B星\r\n\u0007 & <月亮>  ");
    expect(normalized).toBe("星星\n & <月亮>");
    expect(createEdgeTtsSsml(normalized, "zh-CN-XiaoxiaoNeural")).toContain(
      "星星\n &amp; &lt;月亮&gt;",
    );
  });

  it("extracts MP3 bytes from an Edge binary frame", () => {
    expect(parseEdgeTtsBinaryFrame(createAudioFrame(Buffer.from("ID3audio")))?.toString()).toBe(
      "ID3audio",
    );
  });
});

describe("Edge TTS connection retries", () => {
  it("retries an empty close and returns MP3 bytes from the next connection", async () => {
    const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (typeof address === "string" || !address) {
      throw new Error("测试 WebSocket 服务未获取到端口。");
    }

    process.env.EDGE_TTS_WEBSOCKET_URL = `ws://127.0.0.1:${address.port}/edge/v1`;
    process.env.EDGE_TTS_MAX_ATTEMPTS = "2";
    let connectionCount = 0;
    let receivedSsml = "";

    server.on("connection", (socket, request) => {
      connectionCount += 1;
      const currentConnection = connectionCount;
      const url = new URL(request.url || "/", "ws://127.0.0.1");
      expect(url.searchParams.get("TrustedClientToken")).toBeTruthy();
      expect(url.searchParams.get("Sec-MS-GEC")).toMatch(/^[A-F0-9]{64}$/);
      expect(request.headers.cookie).toMatch(/^muid=[A-F0-9]{32};$/);

      let messageCount = 0;
      socket.on("message", (raw) => {
        messageCount += 1;
        if (messageCount !== 2) return;

        receivedSsml = raw.toString();
        if (currentConnection === 1) {
          socket.close(1000, "retry");
          return;
        }

        socket.send(createAudioFrame(Buffer.from("ID3mock-edge-audio")), {
          binary: true,
        });
        socket.send("Path:turn.end\r\n\r\n");
      });
    });

    try {
      const result = await synthesizeEdgeTtsAudio({
        text: "测试",
        voice: "zh-CN-XiaoxiaoNeural",
      });

      expect(connectionCount).toBe(2);
      expect(receivedSsml).toContain("Path:ssml");
      expect(receivedSsml).toContain("zh-CN-XiaoxiaoNeural");
      expect(result.bytes.toString()).toBe("ID3mock-edge-audio");
      expect(result.usage).toEqual({ characters: 2 });
    } finally {
      for (const client of server.clients) client.terminate();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
