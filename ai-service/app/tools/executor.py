"""Dispatches model-requested tool calls to their concrete implementations.

Every handler receives the raw arguments dict the model produced, a
ToolContext carrying the caller's identity, and a CoreServiceClient to
act through. Handlers never touch the database directly — all state
changes go through core-service's HTTP API, which independently
enforces ownership.
"""
import uuid
from dataclasses import dataclass
from typing import Awaitable, Callable, Dict

from app.clients.core_service_client import CoreServiceClient
from app.core.exceptions import UnknownToolError


@dataclass
class ToolContext:
    """Identity of the user the agent is acting on behalf of."""

    user_id: uuid.UUID
    access_token: str


ToolHandler = Callable[[dict, ToolContext, CoreServiceClient], Awaitable[dict]]


async def _create_task(
    args: dict, ctx: ToolContext, client: CoreServiceClient
) -> dict:
    return await client.create_task(
        ctx.access_token,
        title=args["title"],
        description=args.get("description"),
        priority=args.get("priority", "medium"),
        due_date=args.get("due_date"),
        tags=args.get("tags"),
    )


async def _list_tasks(
    args: dict, ctx: ToolContext, client: CoreServiceClient
) -> dict:
    return await client.list_tasks(
        ctx.access_token,
        status=args.get("status"),
        priority=args.get("priority"),
        tag=args.get("tag"),
        overdue=args.get("overdue"),
        today=args.get("today"),
        upcoming=args.get("upcoming"),
        recurring=args.get("recurring"),
    )


async def _bulk_reschedule_overdue_tasks(
    args: dict, ctx: ToolContext, client: CoreServiceClient
) -> dict:
    return await client.bulk_reschedule_overdue_tasks(
        ctx.access_token,
        new_due_date=args["new_due_date"],
        task_ids=args.get("task_ids"),
    )


async def _bulk_complete_overdue_tasks(
    args: dict, ctx: ToolContext, client: CoreServiceClient
) -> dict:
    return await client.bulk_complete_overdue_tasks(
        ctx.access_token,
        task_ids=args.get("task_ids"),
    )


async def _update_task(
    args: dict, ctx: ToolContext, client: CoreServiceClient
) -> dict:
    task_id = args["task_id"]
    return await client.update_task(
        ctx.access_token,
        task_id,
        title=args.get("title"),
        description=args.get("description"),
        status=args.get("status"),
        priority=args.get("priority"),
        due_date=args.get("due_date"),
    )


async def _delete_task(
    args: dict, ctx: ToolContext, client: CoreServiceClient
) -> dict:
    await client.delete_task(ctx.access_token, args["task_id"])
    return {"status": "deleted", "task_id": args["task_id"]}


async def _create_meeting(
    args: dict, ctx: ToolContext, client: CoreServiceClient
) -> dict:
    return await client.create_meeting(
        ctx.access_token,
        title=args["title"],
        start_time=args["start_time"],
        end_time=args["end_time"],
        description=args.get("description"),
        location=args.get("location"),
        participants=args.get("participants"),
    )


async def _list_meetings(
    args: dict, ctx: ToolContext, client: CoreServiceClient
) -> dict:
    return await client.list_meetings(
        ctx.access_token,
        status=args.get("status"),
        starts_after=args.get("starts_after"),
        starts_before=args.get("starts_before"),
        overdue=args.get("overdue"),
        missed=args.get("missed"),
        today=args.get("today"),
        upcoming=args.get("upcoming"),
    )


async def _cancel_meeting(
    args: dict, ctx: ToolContext, client: CoreServiceClient
) -> dict:
    return await client.cancel_meeting(ctx.access_token, args["meeting_id"])


async def _create_reminder(
    args: dict, ctx: ToolContext, client: CoreServiceClient
) -> dict:
    return await client.create_reminder(
        ctx.access_token,
        remind_at=args["remind_at"],
        message=args.get("message"),
        task_id=args.get("task_id"),
        meeting_id=args.get("meeting_id"),
    )


async def _list_reminders(
    args: dict, ctx: ToolContext, client: CoreServiceClient
) -> dict:
    return await client.list_reminders(
        ctx.access_token, is_sent=args.get("is_sent")
    )


async def _delete_reminder(
    args: dict, ctx: ToolContext, client: CoreServiceClient
) -> dict:
    await client.delete_reminder(ctx.access_token, args["reminder_id"])
    return {"status": "deleted", "reminder_id": args["reminder_id"]}


TOOL_HANDLERS: Dict[str, ToolHandler] = {
    "create_task": _create_task,
    "list_tasks": _list_tasks,
    "bulk_reschedule_overdue_tasks": _bulk_reschedule_overdue_tasks,
    "bulk_complete_overdue_tasks": _bulk_complete_overdue_tasks,
    "update_task": _update_task,
    "delete_task": _delete_task,
    "create_meeting": _create_meeting,
    "list_meetings": _list_meetings,
    "cancel_meeting": _cancel_meeting,
    "create_reminder": _create_reminder,
    "list_reminders": _list_reminders,
    "delete_reminder": _delete_reminder,
}


class ToolExecutor:
    """Looks up and invokes the handler for a requested tool name."""

    def __init__(self, core_client: CoreServiceClient) -> None:
        self.core_client = core_client

    async def execute(
        self, tool_name: str, arguments: dict, context: ToolContext
    ) -> dict:
        handler = TOOL_HANDLERS.get(tool_name)
        if handler is None:
            raise UnknownToolError(tool_name)
        result = await handler(arguments, context, self.core_client)
        return result if result is not None else {"status": "ok"}
