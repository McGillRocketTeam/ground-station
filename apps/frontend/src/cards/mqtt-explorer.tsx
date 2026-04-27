import { useAtomValue } from "@effect/atom-react";
import { Schema } from "effect";
import { Cause, Effect, Queue, Scope, Stream } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import mqtt from "mqtt";
import { memo, useEffect, useState } from "react";

import { makeCard } from "@/lib/cards";
import { FormTitleAnnotationId } from "@/lib/form";

type TopicEntry = {
  lastPayload: string;
  messageCount: number;
  topic: string;
};

type MqttExplorerState = {
  status: "connecting" | "connected" | "offline" | "error";
  topics: Record<string, TopicEntry>;
};

type TopicNode = {
  children: Map<string, TopicNode>;
  messageCount: number;
  name: string;
  topic: string;
  value?: TopicEntry;
};

const DEFAULT_MQTT_URL =
  import.meta.env.MQTT_BROKER_URL ?? "ws://localhost:9001";

const MqttExplorerCardConfigSchema = Schema.Struct({
  brokerUrl: Schema.optional(Schema.String).pipe(
    Schema.annotate({ [FormTitleAnnotationId]: "MQTT Broker URL" }),
  ),
});

const mqttExplorerAtom = Atom.family((brokerUrl: string) =>
  Atom.make(
    Stream.callback<MqttExplorerState>((queue) =>
      Effect.gen(function* () {
        const topics = new Map<string, TopicEntry>();
        const client = mqtt.connect(brokerUrl, {
          reconnectPeriod: 1500,
        });

        const publish = (status: MqttExplorerState["status"]) => {
          Queue.offerUnsafe(queue, {
            status,
            topics: Object.fromEntries(topics),
          });
        };

        client.on("connect", () => {
          client.subscribe("#");
          publish("connected");
        });
        client.on("reconnect", () => publish("connecting"));
        client.on("offline", () => publish("offline"));
        client.on("error", () => publish("error"));
        client.on("message", (topic, payload) => {
          const current = topics.get(topic);
          topics.set(topic, {
            lastPayload: payload.toString("utf8"),
            messageCount: (current?.messageCount ?? 0) + 1,
            topic,
          });
          publish("connected");
        });

        publish("connecting");

        yield* Scope.addFinalizer(
          yield* Scope.Scope,
          Effect.sync(() => client.end(true)),
        );
      }),
    ),
    {
      initialValue: {
        status: "connecting",
        topics: {},
      },
    },
  ),
);

function buildTree(topics: Record<string, TopicEntry>) {
  const root: TopicNode = {
    children: new Map(),
    messageCount: 0,
    name: "root",
    topic: "",
  };

  for (const entry of Object.values(topics)) {
    const parts = entry.topic.split("/").filter(Boolean);
    let node = root;
    node.messageCount += entry.messageCount;

    for (const part of parts) {
      const topic = node.topic ? `${node.topic}/${part}` : part;
      let child = node.children.get(part);

      if (!child) {
        child = {
          children: new Map(),
          messageCount: 0,
          name: part,
          topic,
        };
        node.children.set(part, child);
      }

      child.messageCount += entry.messageCount;
      node = child;
    }

    node.value = entry;
  }

  return root;
}

function topicCount(node: TopicNode) {
  let count = node.value ? 1 : 0;

  for (const child of node.children.values()) {
    count += topicCount(child);
  }

  return count;
}

const TopicTreeNode = memo(function TopicTreeNode({
  depth,
  node,
}: {
  depth: number;
  node: TopicNode;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [highlighted, setHighlighted] = useState(false);
  const hasChildren = node.children.size > 0;
  const children = Array.from(node.children.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  useEffect(() => {
    if (!node.value) return;

    setHighlighted(true);
    const timeout = setTimeout(() => setHighlighted(false), 300);

    return () => clearTimeout(timeout);
  }, [node.value?.lastPayload, node.value?.messageCount]);

  return (
    <div>
      <button
        className="sticky flex h-6 w-max min-w-full items-center gap-1 bg-background px-1 text-left leading-6 hover:bg-selection-background"
        style={{
          paddingLeft: `${depth * 14 + 4}px`,
          top: `${24 + depth * 24}px`,
          zIndex: 9 - Math.min(depth, 8),
        }}
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className="w-3 text-muted-foreground">
          {hasChildren ? (expanded ? "▼" : "▶") : ""}
        </span>
        <span className="">{node.name}</span>
        {hasChildren ? (
          <span className="text-muted-foreground">
            ({topicCount(node)} topics, {node.messageCount} messages)
          </span>
        ) : null}
      </button>
      {node.value ? (
        <div
          className="grid h-6 w-max grid-cols-[auto_auto] items-center gap-1 px-1 leading-6 transition-colors duration-300 hover:bg-selection-background data-[highlighted=true]:bg-selection-background/50"
          data-highlighted={highlighted}
          style={{ paddingLeft: `${(depth + 1) * 14 + 20}px` }}
        >
          <span className="">value =</span>
          <span
            className="font-sans whitespace-pre"
            title={node.value.lastPayload}
          >
            {node.value.lastPayload}
          </span>
        </div>
      ) : null}
      {expanded
        ? children.map((child) => (
            <TopicTreeNode key={child.topic} depth={depth + 1} node={child} />
          ))
        : null}
    </div>
  );
});

function MqttExplorer({ brokerUrl }: { brokerUrl: string }) {
  const result = useAtomValue(mqttExplorerAtom(brokerUrl));

  return AsyncResult.match(result, {
    onInitial: () => (
      <div className="p-2 text-muted-foreground">Connecting...</div>
    ),
    onFailure: ({ cause }) => (
      <pre className="p-2 text-error">{Cause.pretty(cause)}</pre>
    ),
    onSuccess: ({ value }) => {
      const root = buildTree(value.topics);
      const children = Array.from(root.children.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      );

      return (
        <div className="h-full overflow-auto font-mono text-sm">
          <div className="sticky top-0 z-20 h-6 bg-background px-2 leading-6 text-muted-foreground">
            {brokerUrl} · {value.status}
          </div>
          <div className="w-max min-w-full px-1 pb-1">
            {children.length === 0 ? (
              <div className="p-2 text-muted-foreground">
                No topics received.
              </div>
            ) : (
              children.map((child) => (
                <TopicTreeNode key={child.topic} depth={0} node={child} />
              ))
            )}
          </div>
        </div>
      );
    },
  });
}

export const MqttExplorerCard = makeCard({
  id: "mqtt-explorer",
  name: "MQTT Explorer",
  schema: MqttExplorerCardConfigSchema,
  component: (props) => (
    <MqttExplorer brokerUrl={props.params.brokerUrl ?? DEFAULT_MQTT_URL} />
  ),
});
