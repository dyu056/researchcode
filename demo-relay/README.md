# OpenCode Relay Demo

A demonstration of session management and relay system for OpenCode.

## Features

1. **Session Creation with Custom Model**
   - Create sessions with custom API key, endpoint, and model name
   - Each session can have its own model configuration

2. **Session Spawning**
   - Sessions can spawn child sessions
   - Child sessions inherit parent's model configuration
   - Sessions organized into folders

3. **Relay System**
   - Relay Hub folder for inter-session communication
   - All session events logged to relay
   - Sessions can relay messages to other sessions

## How to Run

```bash
# Install dependencies
cd demo-relay
bun install

# Start the demo (ensure OpenCode server is running on port 4096)
bun dev

# Or with npm
npm install
npm run dev
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        DEMO FRONTEND                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   Folder    │    │   Folder    │    │   Relay     │      │
│  │  /project   │    │  /research  │    │    Hub      │      │
│  │  ├── sess1 │    │  ├── sess3  │    │  sess-relay│      │
│  │  └── sess2 │    │  └── sess4  │    │             │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│          │                 │                  │             │
│          └─────────────────┴──────────────────┘             │
│                           │                                  │
│                    ┌──────┴──────┐                           │
│                    │  RELAY LOG  │                           │
│                    │  (events)   │                           │
│                    └─────────────┘                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     OPENCODE SERVER                          │
│                   (opencode serve)                           │
│                                                              │
│  sdk.session.create()   sdk.session.prompt()                │
│  sdk.event.subscribe()  sdk.session.children()              │
└─────────────────────────────────────────────────────────────┘
```

## Session Flow

1. **Create Session** → User fills form with title, folder, optional model config
2. **Send Message** → Message sent via `sdk.session.prompt()`
3. **Spawn Child** → Parent session can create child sessions
4. **Relay** → Messages relayed through shared folder

## To Implement in OpenCode

### 1. Modify `Session.create()` to accept model credentials

```typescript
// packages/opencode/src/server/session.ts
interface CreateSessionInput {
  title?: string
  parentID?: string
  model?: {
    providerID: string
    modelID: string
    apiKey?: string
    apiEndpoint?: string
  }
}
```

### 2. Add relay event system

```typescript
// packages/opencode/src/relay/events.ts
// New endpoint for cross-session messaging
POST /session/{sessionID}/relay
```

### 3. Frontend uses SDK

```typescript
import { createOpencodeClient } from '@opencode-ai/sdk/v2'

const sdk = createOpencodeClient({ baseUrl: 'http://localhost:4096' })

// Create session with custom model
const session = await sdk.session.create({
  title: 'Research Agent',
  model: { providerID: 'custom', modelID: 'claude-3', apiKey: 'sk-...' }
})

// Subscribe to events
const events = await sdk.event.subscribe()
for await (const event of events.stream) {
  console.log(event)
}
```

## Current Status

- [x] Basic UI structure
- [x] Session creation form with model config
- [x] Folder organization
- [x] Relay log visualization
- [ ] OpenCode server integration (requires OpenCode modifications)
- [ ] Real cross-session messaging
