# WorkspaceEngine 🪐

A production-grade, extensible, block-based collaborative workspace platform inspired by Notion.

Built on a modern decoupled architecture featuring Next.js 15 (React 19), Yjs CRDT real-time multiplayer synchronization, fractional indexing for $O(1)$ block drag-and-drop, and a high-performance FastAPI + PostgreSQL 16 tree-hierarchy backend.

---

## Architecture Overview

```
                      ┌──────────────────────────────────────┐
                      │  Frontend (Next.js 15, React 19)     │
                      │  - Block Editor Core                 │
                      │  - Slash Commands (/) & Drag Handles │
                      │  - Yjs CRDT & Presence Awareness     │
                      │  - Tailwind & Lucide Icons           │
                      └──────────────┬───────────────────────┘
                                     │
                    HTTP REST        │        WebSockets (Yjs Sync)
                 (Pages, Auth,       │      (CRDT Document & Cursor
                    Search)          │             Presence)
                                     ▼
                      ┌──────────────────────────────────────┐
                      │  Backend API & WebSocket Server      │
                      │  (FastAPI + Asyncpg + SQLAlchemy 2)  │
                      │  - Workspaces, Pages & Blocks API    │
                      │  - Fractional Indexing Engine        │
                      │  - Yjs CRDT WebSocket Gateway        │
                      │  - S3 / MinIO Presigned URLs         │
                      └──────┬────────────────────────┬──────┘
                             │                        │
                             ▼                        ▼
              ┌────────────────────────┐   ┌────────────────────────┐
              │ PostgreSQL 16          │   │ Redis 7                │
              │ - Workspace & Members  │   │ - Ephemeral cursors    │
              │ - Pages Tree Adjacency │   │ - Yjs room pub/sub     │
              │ - Blocks & JSONB Data  │   │ - Presence tracking    │
              │ - Full-Text Search     │   └────────────────────────┘
              └────────────────────────┘
```

---

## Key Features Implemented

### 1. Workspace Hierarchy & Layout
- **Infinite Sub-Page Tree Navigation**: Collapsible disclosure nodes, nested child page creation (`+`), page reordering, and favoriting.
- **Dynamic Breadcrumbs**: Reflects complete ancestor path from root to current page.
- **Page Customization**: Cover image picker with Unsplash presets and emoji icon selector.
- **Share Modal**: Workspace member permissions (Owner, Editor, Viewer) and public web access toggles.

### 2. Block Editor Core
- **Floating Slash Menu (`/`)**: 14+ standard block types (H1, H2, H3, Text, Bulleted List, Numbered List, To-do with checkbox, Toggle collapse, Code block with syntax selector, Quote, Callout box, Divider, Table, Image).
- **Draggable Handles (`:::`)**: Notion-style hover controls on the left gutter with click actions (Delete, Duplicate, Turn into, Copy link) and HTML5 drag-and-drop vertical reordering.
- **Keyboard Shortcuts**:
  - `Enter`: Splits block or appends next item of matching type.
  - `Backspace`: At caret position 0, converts block to text or merges with previous block.
  - `Tab` / `Shift+Tab`: Indents/unindents block to create nested lists or toggle contents.
  - **Markdown triggers**: `# `, `## `, `### `, `- `, `* `, `1. `, `[] `, `>`, ````, `---`.
- **Rich-Text Bubble Menu**: Selection floating toolbar for Bold, Italic, Strikethrough, Inline Code, Hyperlink, and Color palette.

### 3. Collaborative CRDT Engine (Yjs + WebSocket)
- **Multiplayer Real-Time Collaboration**: Built on Yjs CRDTs over WebSockets for conflict-free document convergence.
- **Live Presence & Cursors**: Avatars carousel in topbar and real-time remote user cursor indicators.
- **Local-First Optimistic UI**: Changes update instantly on the client with debounced snapshots persisted to PostgreSQL.

### 4. Full-Text Search & Persistence
- **Fuzzy Search Modal (`Cmd+K` / `Ctrl+K`)**: Rapid search across page titles and block body contents with keyboard navigation.
- **Fractional Indexing Math ($O(1)$ Reordering)**: Base-62 fractional indexing prevents table rewrites when moving items.

---

## Data Models

- **`workspaces`**: `id`, `name`, `slug` (unique), `icon`, `owner_id`, `created_at`, `updated_at`.
- **`workspace_members`**: `id`, `workspace_id`, `user_id`, `role` (`owner`, `editor`, `viewer`), `created_at`.
- **`pages`**: `id`, `workspace_id`, `parent_id` (nullable), `title`, `icon`, `cover_image`, `is_favorite`, `is_archived`, `sort_order`, `metadata`, `created_at`, `updated_at`.
- **`blocks`**: `id` (UUID), `page_id`, `parent_block_id` (nullable), `type`, `content` (rich text JSON), `properties` (JSONB for checked status, language, colors), `sort_order`, `created_at`, `updated_at`.

---

## Running Locally

### Using Docker Compose
```bash
docker compose -f workspace-engine/docker-compose.yml up -d --build
```
- Frontend: `http://localhost:3000`
- Backend API Docs: `http://localhost:8000/docs`
- MinIO Console: `http://localhost:9001` (`minioadmin` / `minioadmin`)

### Running Backend Tests
```bash
source .venv/bin/activate
PYTHONPATH=workspace-engine/backend pytest workspace-engine/backend/tests -v
```

### Running Frontend Tests & Typecheck
```bash
./frontend/node_modules/.bin/vitest run workspace-engine/frontend/tests
./frontend/node_modules/.bin/tsc --project workspace-engine/frontend/tsconfig.json --noEmit
```
