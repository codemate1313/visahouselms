import { type FormEvent, useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { API_BASE_URL, apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";

interface Preset {
  name: string;
  label: string;
  description: string;
}

const WS_BASE = API_BASE_URL.replace(/^http/, "ws");

export function Terminal() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const [presets, setPresets] = useState<Preset[]>([]);
  const [connected, setConnected] = useState(false);
  const [running, setRunning] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    apiClient.get("/super-admin/terminal/presets").then(({ data }) => setPresets(data));
    return () => {
      socketRef.current?.close();
      termRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (connected && containerRef.current && !termRef.current) {
      const term = new XTerm({
        convertEol: true,
        fontSize: 13,
        theme: { background: "#171a26" },
        cursorBlink: false,
        disableStdin: true,
      });
      term.open(containerRef.current);
      term.writeln("\x1b[1;32mIELTS LMS terminal - preset commands only.\x1b[0m");
      term.writeln("Select a command from the palette on the left.\r\n");
      termRef.current = term;
    }
  }, [connected]);

  async function connect(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setConnecting(true);
    try {
      const { data } = await apiClient.post("/super-admin/terminal/open", { password });
      setPassword("");

      const socket = new WebSocket(`${WS_BASE}/super-admin/terminal/ws?ticket=${data.ticket}`);
      socket.onopen = () => setConnected(true);
      socket.onmessage = (message) => {
        const msg = JSON.parse(message.data);
        const term = termRef.current;
        if (!term) return;
        if (msg.type === "ready") term.writeln(`\x1b[90m${msg.message}\x1b[0m`);
        if (msg.type === "start") {
          setRunning(true);
          term.writeln(`\x1b[1;36m▶ ${msg.preset}\x1b[0m`);
        }
        if (msg.type === "line") term.writeln(msg.data);
        if (msg.type === "end") {
          setRunning(false);
          term.writeln("");
        }
        if (msg.type === "error") {
          setRunning(false);
          term.writeln(`\x1b[1;31m${msg.message}\x1b[0m`);
        }
        if (msg.type === "closed") term.writeln(`\x1b[1;33m${msg.message}\x1b[0m`);
      };
      socket.onclose = () => {
        setConnected(false);
        setRunning(false);
        termRef.current?.writeln("\x1b[1;33mConnection closed.\x1b[0m");
      };
      socketRef.current = socket;
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to open terminal."));
    } finally {
      setConnecting(false);
    }
  }

  function runPreset(preset: Preset) {
    if (!socketRef.current || running) return;
    socketRef.current.send(JSON.stringify({ preset: preset.name }));
  }

  if (!connected) {
    return (
      <div>
        <h1>CMD Terminal</h1>
        <form className="form-card" onSubmit={connect}>
          <p className="hint">
            Security check: re-enter your password to open a terminal session. Only
            whitelisted preset commands can run; every command is audit-logged.
          </p>
          <label htmlFor="terminal_password">Password</label>
          <input
            id="terminal_password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button type="submit" disabled={connecting || !password}>
              {connecting ? "Opening..." : "Open Terminal"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1>CMD Terminal</h1>
      <div className="terminal-layout">
        <div className="preset-palette">
          {presets.map((preset) => (
            <button
              key={preset.name}
              disabled={running}
              onClick={() => runPreset(preset)}
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="terminal-frame" ref={containerRef} />
      </div>
    </div>
  );
}
