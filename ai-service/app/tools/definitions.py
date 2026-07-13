"""OpenAI tool (function-calling) definitions.

Each entry follows the OpenAI `tools` schema. Names here must exactly
match the keys registered in app.tools.executor.TOOL_HANDLERS.
"""
from typing import List

TOOL_DEFINITIONS: List[dict] = [
    {
        "type": "function",
        "function": {
            "name": "create_task",
            "description": (
                "Create a new to-do task for the user. Use this whenever "
                "the user asks to add, create, or remember a task or "
                "to-do item."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Short, clear title for the task.",
                    },
                    "description": {
                        "type": "string",
                        "description": "Optional longer description or notes.",
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["low", "medium", "high", "urgent"],
                        "description": "Task priority. Defaults to medium.",
                    },
                    "due_date": {
                        "type": "string",
                        "description": "ISO 8601 datetime the task is due, e.g. 2026-07-20T17:00:00Z.",
                    },
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Free-text labels for the task.",
                    },
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_tasks",
            "description": "List the user's tasks, optionally filtered by status, priority, or tag.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "enum": ["pending", "in_progress", "completed", "cancelled"],
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["low", "medium", "high", "urgent"],
                    },
                    "tag": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_task",
            "description": (
                "Update an existing task's title, description, status, "
                "priority, or due date. Use status='completed' when the "
                "user says they finished a task."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "UUID of the task."},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "status": {
                        "type": "string",
                        "enum": ["pending", "in_progress", "completed", "cancelled"],
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["low", "medium", "high", "urgent"],
                    },
                    "due_date": {"type": "string"},
                },
                "required": ["task_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_task",
            "description": "Permanently delete a task.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "UUID of the task."},
                },
                "required": ["task_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_meeting",
            "description": "Schedule a new meeting, optionally inviting participants by email.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "location": {"type": "string"},
                    "start_time": {
                        "type": "string",
                        "description": "ISO 8601 start datetime.",
                    },
                    "end_time": {
                        "type": "string",
                        "description": "ISO 8601 end datetime, must be after start_time.",
                    },
                    "participants": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "email": {"type": "string"},
                                "name": {"type": "string"},
                            },
                            "required": ["email"],
                        },
                    },
                },
                "required": ["title", "start_time", "end_time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_meetings",
            "description": "List the user's meetings, optionally filtered by status or time range.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "enum": ["scheduled", "cancelled", "completed"],
                    },
                    "starts_after": {"type": "string"},
                    "starts_before": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "cancel_meeting",
            "description": "Cancel an existing meeting.",
            "parameters": {
                "type": "object",
                "properties": {
                    "meeting_id": {"type": "string", "description": "UUID of the meeting."},
                },
                "required": ["meeting_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_reminder",
            "description": (
                "Create a reminder. It may stand alone, or be linked to "
                "exactly one existing task or meeting via task_id or "
                "meeting_id, not both."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "remind_at": {
                        "type": "string",
                        "description": "ISO 8601 datetime to send the reminder.",
                    },
                    "message": {"type": "string"},
                    "task_id": {"type": "string"},
                    "meeting_id": {"type": "string"},
                },
                "required": ["remind_at"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_reminders",
            "description": "List the user's reminders, optionally filtered by whether they've already fired.",
            "parameters": {
                "type": "object",
                "properties": {
                    "is_sent": {"type": "boolean"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_reminder",
            "description": "Delete a reminder.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reminder_id": {"type": "string", "description": "UUID of the reminder."},
                },
                "required": ["reminder_id"],
            },
        },
    },
]
