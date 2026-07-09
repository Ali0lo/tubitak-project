AI-Powered To-Do & Meeting Assistant

An AI-driven productivity platform that combines task management, meeting scheduling, reminders, and conversational assistance into a single application.

Features

* Task management
* Meeting scheduling
* Smart reminders
* AI assistant with tool calling
* Calendar and schedule dashboard
* Notifications and email alerts

Architecture

The project follows a microservice-based monorepo architecture:

frontend
gateway
auth-service
core-service
ai-service
notification-service

Responsibilities

* Frontend — Next.js dashboard and chat interface
* Gateway — API routing, JWT validation, rate limiting
* Auth Service — Authentication and token management
* Core Service — Tasks, meetings, reminders, schedules
* AI Service — Conversational AI and tool orchestration
* Notification Service — Emails, reminders, background jobs

Tech Stack

Backend

* Python 3.12
* FastAPI
* PostgreSQL
* Redis
* SQLAlchemy
* Alembic

Frontend

* Next.js 14
* TypeScript
* TailwindCSS
* React Query
* Zustand

Infrastructure

* Docker
* Docker Compose
* Nginx
* GitHub Actions

Getting Started

Start infrastructure services:

docker compose up -d

Verify containers:

docker ps

Project Structure

todotak/
├── frontend/
├── gateway/
├── auth-service/
├── core-service/
├── ai-service/
├── notification-service/
├── shared/
├── infra/
├── tests/
└── docs/

Status

This repository currently contains the project architecture, service structure, and infrastructure setup. Service implementations are being developed incrementally.

License

MIT License
