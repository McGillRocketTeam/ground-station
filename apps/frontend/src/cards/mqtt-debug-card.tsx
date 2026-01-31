/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IDockviewPanelProps } from "dockview-react";
import mqtt from "mqtt";
import { useEffect, useState } from "react";
import { makeCard } from "@/lib/cards";
import { FormTitleAnnotationId, FormTypeAnnotationId } from "@/lib/form";
import { Schema } from "effect";

const CardSchema = Schema.Struct({
    brokerUrl: Schema.URL.annotations({
      [FormTitleAnnotationId]: "Broker URL",
      [FormTypeAnnotationId]: "string",
    }),
  })

export const MqttDebugCard = makeCard({
  id: "mqtt-debug-card",
  name: "MQTT Debug Card",
  schema: CardSchema,
  component: MqttDebugComponent,
});

function MqttDebugComponent({
  params,
}: IDockviewPanelProps<typeof CardSchema.Type>) {
  // debug tree has keys that are strings and values of any type
  const [treeData, setTreeData] = useState<Record<string, any>>({});
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // WebSocket MQTT endpoint for Yamcs / Mosquitto broker: ws://test.mosquitto.org:8080/mqtt
    const mqttClient = mqtt.connect(params.brokerUrl.toString());

    mqttClient.on("connect", () => {
      setIsConnected(true);

      // Subscribe to all topics
      mqttClient.subscribe("#");
    });

    mqttClient.on("message", (topic, payload) => {
      let data: any;

      try {
        // Try to parse JSON messages
        data = JSON.parse(payload.toString());
      } catch {
        // Keep as string if not JSON
        data = payload.toString();
      }

      // Add metadata - the full topic and the time it was sent
      data = {
        value: data,
        meta: { topic, time: new Date().toLocaleString() },
      };

      // Build nested tree structure from topic path
      setTreeData((prev) => {
        const parts = topic.split("/");
        // shallow copy of existing tree
        const newTree = { ...prev };
        // pointer to the new tree
        let node = newTree;

        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          node[part] = node[part] || {};
          // set pointer to next node
          node = node[part];
        }

        // add the data
        node[parts[parts.length - 1]] = data;
        return newTree;
      });
    });

    mqttClient.on("error", (err) => {
      console.error("MQTT Error:", err);
    });

    return () => {
      mqttClient.end();
    };
  }, [params.brokerUrl]);

  return (
    <div className="h-full w-full overflow-auto p-2">
      {!isConnected && <div>Connecting to MQTT broker...</div>}

      {isConnected && (
        <div className="font-mono text-sm">
          {Object.entries(treeData).map((entry) => (
            <TreeElement key={entry[0]} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeElement({ entry }: { entry: [string, any] }) {
  const [topic, data] = entry;
  const [expanded, setExpanded] = useState(false);

  const isExpandable = typeof data === "object" && data !== null;

  return (
    // Indent each topic 4 spaces from the left margin
    <div className="ml-2">
      {/* Clickable topic name */}
      <div
        className={`select-none ${
          isExpandable ? "cursor-pointer hover:opacity-75" : "cursor-default"
        }`}
        onClick={() => isExpandable && setExpanded(!expanded)}
      >
        {topic}
        {isExpandable ? (expanded ? " ▼" : " ▶") : ":"}
      </div>

      {/* Displaying nested structure */}
      {isExpandable && expanded && (
        <div className="ml-2 border-l">
          {Object.entries(data).map((childEntry) => (
            <TreeElement key={childEntry[0]} entry={childEntry} />
          ))}
        </div>
      )}

      {/* Displaying primitive values */}
      {!isExpandable && <div className="ml-4">{String(data)}</div>}
    </div>
  );
}
