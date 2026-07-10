// Define Liveblocks types for your application
// https://liveblocks.io/docs/api-reference/liveblocks-react#Typing-your-data
import type { AiCanvasState } from "@/types/ai-canvas"

declare global {
  interface Liveblocks {
    // Each user's Presence, for useMyPresence, useOthers, etc.
    Presence: {
      cursor: {
        x: number
        y: number
      } | null
      thinking: boolean
    };

    // The Storage tree for the room, for useMutation, useStorage, etc.
    // Nodes and edges are managed by `@liveblocks/react-flow` under its own
    // internal `flow` key. `ai` holds the design agent's on-canvas pointer
    // (published by the durable background task). Human-readable AI status text
    // is published to the Liveblocks feed `ai-status-feed`, not Storage.
    Storage: {
      ai?: AiCanvasState;
    };

    // Custom user info set when authenticating with a secret key
    UserMeta: {
      id: string;
      info: {
        name: string
        avatar: string
        color: string
      };
    };

    // Custom events, for useBroadcastEvent, useEventListener
    RoomEvent: {};
      // Example has two events, using a union
      // | { type: "PLAY" } 
      // | { type: "REACTION"; emoji: "🔥" };

    // Custom metadata set on threads, for useThreads, useCreateThread, etc.
    ThreadMetadata: {
      // Example, attaching coordinates to a thread
      // x: number;
      // y: number;
    };

    // Custom room info set with resolveRoomsInfo, for useRoomInfo
    RoomInfo: {
      // Example, rooms with a title and url
      // title: string;
      // url: string;
    };
  }
}

export {};
