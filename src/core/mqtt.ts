import mqtt from "mqtt";
import { Config, MqttTileMessage, FeedbackMessage } from "./types";

let client: mqtt.MqttClient | null = null;

export function connectMqtt(cfg: Config): mqtt.MqttClient {
  client = mqtt.connect(cfg.mqtt.url, {
    clientId: cfg.mqtt.clientId,
    clean: cfg.mqtt.clean,
    keepalive: cfg.mqtt.keepalive,
    username: cfg.mqtt.username,
    password: cfg.mqtt.password,
  });

  (window as any).mqtt = client;

  client.on("connect", () => {
    console.log("[mqtt] Connected to", cfg.mqtt.url);
    client!.subscribe(cfg.mqtt.topic, { qos: 1 }, (err) => {
      if (err) console.error("[mqtt] Subscribe error:", err);
      else console.log("[mqtt] Subscribed to", cfg.mqtt.topic);
    });
  });

  client.on("error", (err) => console.error("[mqtt] Error:", err));
  client.on("reconnect", () => console.log("[mqtt] Reconnecting..."));
  client.on("close", () => console.log("[mqtt] Connection closed"));

  return client;
}

export function onTileMessage(handler: (msg: MqttTileMessage) => void): void {
  if (!client) throw new Error("MQTT client not connected");
  client.on("message", (topic, payload) => {
    try {
      const msg: MqttTileMessage = JSON.parse(payload.toString());
      handler(msg);
    } catch (e) {
      console.error("[mqtt] Failed to parse message:", e);
    }
  });
}

export function publishFeedback(cfg: Config, tileId: string, feedback: FeedbackMessage): void {
  if (!client) return;
  const topic = `${cfg.mqtt.feedbackPrefix}/${tileId}`;
  client.publish(topic, JSON.stringify(feedback), { qos: 0 });
}

export function disconnectMqtt(): void {
  if (client) {
    client.end();
    client = null;
  }
}
