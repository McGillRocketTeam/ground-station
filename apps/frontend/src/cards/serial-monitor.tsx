import { useAtom } from "@effect/atom-react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Schema } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { makeCard } from "@/lib/cards";
import { cn } from "@/lib/utils";

const SERIAL_BAUD_RATE = 115200;
const REQUEST_SOURCE_VALUE = "__request-source__";
const MAX_OUTPUT_CHARS = 50_000;

type SerialPortInfo = {
  usbProductId?: number;
  usbVendorId?: number;
};

type SerialPortLike = {
  close: () => Promise<void>;
  getInfo: () => SerialPortInfo;
  open: (options: { baudRate: number }) => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
};

type SerialLike = EventTarget & {
  getPorts: () => Promise<ReadonlyArray<SerialPortLike>>;
  requestPort: () => Promise<SerialPortLike>;
};

type SerialStatus = "disconnected" | "connecting" | "connected";

function getSerialApi(): SerialLike | undefined {
  return (navigator as Navigator & { serial?: SerialLike }).serial;
}

function formatUsbId(value: number | undefined) {
  return value === undefined ? "----" : value.toString(16).padStart(4, "0").toUpperCase();
}

function getPortLabel(port: SerialPortLike, index: number) {
  const info = port.getInfo();
  const vendor = formatUsbId(info.usbVendorId);
  const product = formatUsbId(info.usbProductId);

  return `Serial source ${index + 1} (${vendor}:${product})`;
}

function appendText(previous: string, next: string) {
  const combined = `${previous}${next}`;

  if (combined.length <= MAX_OUTPUT_CHARS) {
    return combined;
  }

  return combined.slice(combined.length - MAX_OUTPUT_CHARS);
}

function toErrorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : String(caught);
}

function dedupePorts(ports: ReadonlyArray<SerialPortLike>) {
  return Array.from(new Set(ports));
}

function reconcileSelectedPort(
  selectedPort: SerialPortLike | null,
  ports: ReadonlyArray<SerialPortLike>,
) {
  if (selectedPort && ports.includes(selectedPort)) {
    return selectedPort;
  }

  return ports[0] ?? null;
}

const serialMonitorPortsAtom = Atom.family((_scopeId: string) =>
  Atom.make([] as ReadonlyArray<SerialPortLike>),
);

const serialMonitorSelectedPortAtom = Atom.family((_scopeId: string) =>
  Atom.make<SerialPortLike | null>(null),
);

const serialMonitorConnectRequestedAtom = Atom.family((_scopeId: string) => Atom.make(false));

const serialMonitorInputAtom = Atom.family((_scopeId: string) => Atom.make(""));

const serialMonitorOutputAtom = Atom.family((_scopeId: string) => Atom.make(""));

const serialMonitorStatusAtom = Atom.family((_scopeId: string) =>
  Atom.make<SerialStatus>("disconnected"),
);

const serialMonitorErrorAtom = Atom.family((_scopeId: string) => Atom.make<string | null>(null));

function SerialMonitorCardBody({ scopeId }: { scopeId: string }) {
  const [ports, setPorts] = useAtom(serialMonitorPortsAtom(scopeId));
  const [selectedPort, setSelectedPort] = useAtom(serialMonitorSelectedPortAtom(scopeId));
  const [connectRequested, setConnectRequested] = useAtom(
    serialMonitorConnectRequestedAtom(scopeId),
  );
  const [input, setInput] = useAtom(serialMonitorInputAtom(scopeId));
  const [output, setOutput] = useAtom(serialMonitorOutputAtom(scopeId));
  const [status, setStatus] = useAtom(serialMonitorStatusAtom(scopeId));
  const [error, setError] = useAtom(serialMonitorErrorAtom(scopeId));
  const outputRef = useRef<HTMLTextAreaElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const connectedPortRef = useRef<SerialPortLike | null>(null);

  const refreshPorts = async () => {
    const serial = getSerialApi();

    if (!serial) {
      return;
    }

    try {
      const nextPorts = dedupePorts(await serial.getPorts());
      setPorts(nextPorts);
      setSelectedPort((current) => reconcileSelectedPort(current, nextPorts));
      setError(null);

      if (nextPorts.length === 0) {
        setConnectRequested(false);
      }
    } catch (caught) {
      setError(toErrorMessage(caught));
    }
  };

  const requestPort = async () => {
    const serial = getSerialApi();

    if (!serial) {
      setError("Web Serial is not available in this browser context.");
      return;
    }

    try {
      const port = await serial.requestPort();
      const nextPorts = dedupePorts([...ports, port]);

      setPorts(nextPorts);
      setSelectedPort(port);
      setConnectRequested(true);
      setError(null);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "NotFoundError") {
        return;
      }

      setError(toErrorMessage(caught));
    }
  };

  useEffect(() => {
    void refreshPorts();

    const serial = getSerialApi();

    if (!serial) {
      return;
    }

    const handlePortChange = () => {
      void refreshPorts();
    };

    serial.addEventListener("connect", handlePortChange);
    serial.addEventListener("disconnect", handlePortChange);

    return () => {
      serial.removeEventListener("connect", handlePortChange);
      serial.removeEventListener("disconnect", handlePortChange);
    };
  }, []);

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight });
  }, [output]);

  useEffect(() => {
    let cancelled = false;

    const closeCurrentConnection = async () => {
      const reader = readerRef.current;
      readerRef.current = null;

      if (reader) {
        try {
          await reader.cancel();
        } catch {
          // Ignore reader cancellation failures during disconnect.
        }
      }

      const port = connectedPortRef.current;
      connectedPortRef.current = null;

      if (port) {
        try {
          await port.close();
        } catch {
          // Ignore close failures during disconnect.
        }
      }
    };

    const connect = async () => {
      if (!connectRequested || !selectedPort) {
        await closeCurrentConnection();

        if (!cancelled) {
          setStatus("disconnected");
        }
        return;
      }

      setStatus("connecting");
      setError(null);
      setOutput("");
      await closeCurrentConnection();

      try {
        await selectedPort.open({ baudRate: SERIAL_BAUD_RATE });
        connectedPortRef.current = selectedPort;

        const readable = selectedPort.readable;
        if (!readable) {
          throw new Error("The selected serial source does not expose a readable stream.");
        }

        const reader = readable.getReader();
        const decoder = new TextDecoder();
        readerRef.current = reader;

        if (!cancelled) {
          setStatus("connected");
        }

        while (!cancelled && connectedPortRef.current === selectedPort) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          if (value) {
            const chunk = decoder.decode(value, { stream: true });

            if (chunk && !cancelled) {
              setOutput((previous) => appendText(previous, chunk));
            }
          }
        }

        const tail = decoder.decode();
        if (tail && !cancelled) {
          setOutput((previous) => appendText(previous, tail));
        }
      } catch (caught) {
        if (!cancelled) {
          setError(toErrorMessage(caught));
        }
      } finally {
        await closeCurrentConnection();

        if (!cancelled) {
          setStatus("disconnected");
        }
      }
    };

    void connect();

    return () => {
      cancelled = true;
      void closeCurrentConnection();
    };
  }, [connectRequested, selectedPort, setError, setOutput, setStatus]);

  const selectedPortIndex = selectedPort ? ports.indexOf(selectedPort) : -1;
  const selectedValue = selectedPortIndex >= 0 ? String(selectedPortIndex) : REQUEST_SOURCE_VALUE;
  const showDisconnect = status === "connected";

  const options = useMemo(
    () =>
      ports.map((port, index) => ({
        label: getPortLabel(port, index),
        value: String(index),
      })),
    [ports],
  );

  const sendInput = async () => {
    const connectedPort = connectedPortRef.current;

    if (!connectedPort || status !== "connected") {
      setError("Connect to a serial source before sending data.");
      return;
    }

    const writable = connectedPort.writable;

    if (!writable) {
      setError("The selected serial source does not expose a writable stream.");
      return;
    }

    const writer = writable.getWriter();

    try {
      await writer.write(new TextEncoder().encode(input));
      setOutput((previous) => appendText(previous, input + "\n"));
      setInput("");
      setError(null);
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      writer.releaseLock();
    }
  };

  useHotkey(
    "Mod+Enter",
    () => {
      if (!input.trim()) {
        return;
      }

      void sendInput();
    },
    {
      enabled: inputRef.current === document.activeElement,
      preventDefault: true,
      target: inputRef,
    },
  );

  if (!getSerialApi()) {
    return (
      <div className="p-2 font-mono text-sm text-error">
        Web Serial is not available in this browser context.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 p-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-7 min-w-56 rounded-md border border-input bg-input/20 px-2 text-sm outline-none"
          value={selectedValue}
          onPointerDown={(event) => {
            if (ports.length === 0 && status !== "connected") {
              event.preventDefault();
              void requestPort();
            }
          }}
          onChange={(event) => {
            if (event.target.value === REQUEST_SOURCE_VALUE) {
              void requestPort();
              return;
            }

            const nextPort = ports[Number(event.target.value)];

            if (!nextPort) {
              return;
            }

            setSelectedPort(nextPort);
            setConnectRequested(true);
            setError(null);
          }}
        >
          <option value={REQUEST_SOURCE_VALUE}>Select serial source</option>
          {options.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {showDisconnect ? (
          <Button variant="outline" type="button" onClick={() => setConnectRequested(false)}>
            Disconnect
          </Button>
        ) : (
          <Button type="button" disabled={!selectedPort} onClick={() => setConnectRequested(true)}>
            Connect
          </Button>
        )}
      </div>

      <div
        className={cn(
          "text-xs",
          status === "connected"
            ? "text-success"
            : status === "disconnected"
              ? "text-error"
              : "text-muted-foreground",
        )}
      >
        Status: {status} · Baud: {SERIAL_BAUD_RATE}
      </div>

      {error ? <div className="text-xs text-error">{error}</div> : null}

      <Textarea
        ref={outputRef}
        readOnly
        tabIndex={-1}
        value={output}
        className="min-h-0 flex-1 resize-none border-none bg-background dark:bg-background font-mono shadow-none focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-transparent duration-0"
        placeholder="Serial output will appear here..."
      />

      <div className="flex flex-col gap-2">
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="min-h-lh font-mono"
          placeholder="Type text to send..."
        />
        <div className="flex gap-2">
          <Button type="button" onClick={() => void sendInput()}>
            Send
          </Button>
          <Button variant="outline" type="button" onClick={() => setInput("")}>
            Clear Input
          </Button>
        </div>
      </div>
    </div>
  );
}

export const SerialMonitorCard = makeCard({
  id: "serial-monitor",
  name: "Serial Monitor",
  schema: Schema.Struct({}),
  component: (props) => <SerialMonitorCardBody scopeId={props.api.id} />,
});
