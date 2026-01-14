import { SSEEmitter } from "./emitter";
import { Hedystia } from "./server";

import type {
  MacroData,
  RouteSchema,
  ServerWebSocket,
  SubscriptionHandler,
  WebSocketHandler,
} from "./types";

export { h } from "@hedystia/validations";

export {
  Hedystia,
  SSEEmitter,
  type MacroData,
  type RouteSchema,
  type ServerWebSocket,
  type SubscriptionHandler,
  type WebSocketHandler,
};
export default Hedystia;

export type { RouteDefinition } from "./types/routes";
