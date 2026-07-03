// airlock-live-demo: the real infrastructure behind the streaming demo.
//
// Two Durable Objects:
//   Broadcast   — holds open SSE connections; POST /emit fans an event out to
//                 every connected browser in real time (real network pushes,
//                 not a client-side replay of a canned transcript).
//   LivePointer — the actual "which candidate is live" state a demo target
//                 app serves. A browser watching GET /live-app can literally
//                 see its content change the instant a real promotion happens
//                 — no page reload, this is the same tab.
//
// This Worker does not run the pipeline itself. experiments/live-demo/run.ts
// runs the REAL airlock pipeline (real digest, real deploy, real fanout, real
// keel proof) and POSTs each real step to /emit as it happens. This Worker
// only relays and holds state; it never fabricates an event.

export interface Env {
  BROADCAST: DurableObjectNamespace;
  LIVE_POINTER: DurableObjectNamespace;
}

export class Broadcast {
  state: DurableObjectState;
  sockets: Set<WebSocket> = new Set();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/connect") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.state.acceptWebSocket(server as WebSocket);
      this.sockets.add(server as WebSocket);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/emit" && request.method === "POST") {
      const event = await request.text();
      let delivered = 0;
      for (const ws of this.state.getWebSockets()) {
        try {
          ws.send(event);
          delivered++;
        } catch {
          // dead socket; runtime will clean it up
        }
      }
      return new Response(JSON.stringify({ delivered }), { headers: { "content-type": "application/json" } });
    }

    return new Response("not found", { status: 404 });
  }
}

export class LivePointer {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/set" && request.method === "POST") {
      const body = (await request.json()) as { candidate: string; label: string };
      await this.state.storage.put("candidate", body.candidate);
      await this.state.storage.put("label", body.label);
      await this.state.storage.put("updatedAt", new Date().toISOString());
      return new Response(JSON.stringify({ ok: true }));
    }

    if (url.pathname === "/live-app") {
      const candidate = (await this.state.storage.get<string>("candidate")) ?? "none";
      const label = (await this.state.storage.get<string>("label")) ?? "nothing served yet";
      const updatedAt = (await this.state.storage.get<string>("updatedAt")) ?? "";
      return new Response(
        `<!doctype html><html><body style="font-family:monospace;padding:2rem">
          <h1>the live app</h1>
          <p>serving candidate: <b>${escapeHtml(candidate)}</b></p>
          <p>${escapeHtml(label)}</p>
          <p style="color:#888">last updated ${escapeHtml(updatedAt)}</p>
        </body></html>`,
        { headers: { "content-type": "text/html" } },
      );
    }

    return new Response("not found", { status: 404 });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Route to a single global Broadcast instance and a single global
    // LivePointer instance — one demo, one channel, matching the swarm
    // registry's "one shared instance" pattern.
    if (url.pathname === "/connect" || url.pathname === "/emit") {
      const id = env.BROADCAST.idFromName("the-one-channel");
      return env.BROADCAST.get(id).fetch(request);
    }
    if (url.pathname === "/set" || url.pathname === "/live-app") {
      const id = env.LIVE_POINTER.idFromName("the-one-app");
      return env.LIVE_POINTER.get(id).fetch(request);
    }

    if (url.pathname === "/" || url.pathname === "") {
      return new Response(DEMO_HTML, { headers: { "content-type": "text/html" } });
    }

    return new Response("not found", { status: 404 });
  },
};

// The viewer page: connects over a real WebSocket, renders each real event as
// it arrives, and embeds the real live-app in an iframe so you watch it
// change in the same tab the instant a promotion actually happens.
const DEMO_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>airlock — live demo</title>
<style>
  body { font-family: 'IBM Plex Mono', monospace; background: #0a1216; color: #e6f1f3; padding: 2rem; }
  #log { max-width: 760px; }
  .line { padding: 0.4rem 0; border-bottom: 1px solid #1a2b31; }
  .ok { color: #57d39c; }
  .fail { color: #ff7d68; }
  .step { color: #6cb9d8; }
  iframe { width: 100%; height: 200px; border: 1px solid #333; margin-top: 1rem; background: white; }
</style>
</head>
<body>
  <h1>airlock — watch a real candidate go live</h1>
  <div id="log"></div>
  <h3>the live app (watch this flip):</h3>
  <iframe id="app" src="/live-app"></iframe>
  <script>
    const log = document.getElementById('log');
    const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/connect');
    ws.onmessage = (msg) => {
      const div = document.createElement('div');
      div.className = 'line';
      let data;
      try { data = JSON.parse(msg.data); } catch { data = { text: msg.data }; }
      const cls = data.ok === true ? 'ok' : data.ok === false ? 'fail' : 'step';
      div.innerHTML = '<span class="' + cls + '">[' + (data.step || 'event') + ']</span> ' + (data.text || msg.data);
      log.prepend(div);
      if (data.step === 'promoted') {
        document.getElementById('app').src = '/live-app?t=' + Date.now();
      }
    };
  </script>
</body>
</html>`;
