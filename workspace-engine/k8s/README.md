# WorkspaceEngine Kubernetes (K8s) Production Architecture

This directory contains the production-grade Kubernetes manifests for orchestrating **WorkspaceEngine** (Next.js 15 frontend, FastAPI backend, real-time Yjs CRDT WebSocket collaboration, PostgreSQL 16, Redis 7, MinIO object storage, and NGINX Ingress).

---

## Architecture Overview

```
                      [ External Traffic ]
                               │
                               ▼
                   [ NGINX Ingress Controller ]
                   (WebSocket Upgrade, 3600s timeout)
                     ├── /      ──────► [ Frontend Service:3000 ]
                     │                   └── [ Frontend Pods x2 ]
                     │
                     ├── /api   ──────► [ Backend Service:8000 ]
                     ├── /ws    ──────► [ Backend Pods x2 (HA) ]
                     └── /health                 │
                                                 │
                                 ┌───────────────┼───────────────┐
                                 ▼               ▼               ▼
                        [ Postgres:5432 ] [ Redis:6379 ]  [ MinIO:9000 ]
                         (StatefulSet)     (Pub/Sub Sync)  (Object Store)
                           (PVC 10Gi)        (PVC 5Gi)       (PVC 10Gi)
```

### Components

1. **Stateful Workloads**:
   - `postgres.yaml`: PostgreSQL 16 StatefulSet with 10Gi persistent volume claim and `pg_isready` readiness/liveness probes.
   - `redis.yaml`: Redis 7 StatefulSet with 5Gi persistent volume claim, AOF enabled, for pub/sub message synchronization across backend replicas.
   - `minio.yaml`: MinIO S3-compatible object storage StatefulSet with 10Gi persistent storage for document attachments.
2. **Stateless Microservices**:
   - `backend.yaml`: FastAPI backend + Yjs collaboration server running with 2 replicas, pod anti-affinity, resource requests/limits, and `/health` probes.
   - `frontend.yaml`: Next.js 15 App Router frontend running with 2 replicas, resource requests/limits, and HTTP probes.
3. **Networking & Routing**:
   - `ingress.yaml`: NGINX Ingress with WebSocket upgrade configurations (`proxy-read-timeout: 3600`, `websocket-services`, `proxy-http-version: 1.1`).
   - ClusterIP Services for internal microservice communication.
4. **Configuration & Security**:
   - `configmap.yaml`: Non-sensitive application configuration parameters.
   - `secrets.yaml`: Database credentials, JWT signing keys, S3 credentials.

---

## Deployment Instructions

### 1. Build and Tag Container Images

```bash
# Backend image
docker build -t workspace-engine-backend:latest ./workspace-engine/backend

# Frontend image
docker build -t workspace-engine-frontend:latest ./workspace-engine/frontend
```

*Note: If using Minikube or Kind, load images into the local cluster:*
```bash
minikube image load workspace-engine-backend:latest
minikube image load workspace-engine-frontend:latest
```

### 2. Apply All Manifests via Kustomize

```bash
kubectl apply -k ./workspace-engine/k8s/
```

### 3. Verify Pods and Services

```bash
# Check all resources in the workspace-engine namespace
kubectl get all -n workspace-engine

# Verify PVC storage bindings
kubectl get pvc -n workspace-engine

# Watch rollout status
kubectl rollout status deployment/backend -n workspace-engine
kubectl rollout status deployment/frontend -n workspace-engine
kubectl rollout status statefulset/postgres -n workspace-engine
kubectl rollout status statefulset/redis -n workspace-engine
kubectl rollout status statefulset/minio -n workspace-engine
```

### 4. Enable NGINX Ingress Controller

If using Minikube:
```bash
minikube addons enable ingress
```

Add host entry to `/etc/hosts` (optional, for local domain routing):
```
127.0.0.1 workspace.local
```

Access the application:
- Frontend: `http://localhost/` or `http://workspace.local/`
- Backend API Docs: `http://localhost/docs`
- Health check: `http://localhost/health`
- WebSocket Endpoint: `ws://localhost/ws/collaboration/{page_id}`
