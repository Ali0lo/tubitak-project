"""HTTP client for ai-service -> core-service communication.

Every method forwards the caller's own access token, so core-service
enforces exactly the same ownership rules it would for a direct API
call — the agent never has elevated privileges over the user it acts
for, and never touches the database directly.
"""
from typing import Any, List, Optional

import httpx

from app.core.config import get_settings
from app.core.exceptions import ToolExecutionError

settings = get_settings()


class CoreServiceClient:
    """Thin async wrapper around core-service's HTTP API."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
        client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        self.base_url = (base_url or settings.CORE_SERVICE_URL).rstrip("/")
        self.timeout = timeout or settings.CORE_SERVICE_TIMEOUT_SECONDS
        # Injectable for tests; a fresh client is opened/closed per
        # call when not supplied.
        self._client = client

    async def _request(
        self, method: str, path: str, access_token: str, **kwargs: Any
    ) -> Any:
        headers = {"Authorization": f"Bearer {access_token}"}
        client = self._client or httpx.AsyncClient()
        owns_client = self._client is None
        try:
            response = await client.request(
                method,
                f"{self.base_url}{path}",
                headers=headers,
                timeout=self.timeout,
                **kwargs,
            )
        except httpx.HTTPError as exc:
            raise ToolExecutionError(
                "Could not reach the task/meeting service. Please try again."
            ) from exc
        finally:
            if owns_client:
                await client.aclose()

        if response.status_code >= 400:
            raise ToolExecutionError(self._extract_detail(response))

        if response.status_code == 204 or not response.content:
            return None
        return response.json()

    @staticmethod
    def _extract_detail(response: httpx.Response) -> str:
        try:
            body = response.json()
            if isinstance(body, dict) and "detail" in body:
                return str(body["detail"])
        except ValueError:
            pass
        return f"core-service returned HTTP {response.status_code}"

    # -- Tasks ---------------------------------------------------------

    async def create_task(
        self,
        access_token: str,
        *,
        title: str,
        description: Optional[str] = None,
        priority: str = "medium",
        due_date: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> dict:
        payload: dict = {"title": title, "priority": priority}
        if description is not None:
            payload["description"] = description
        if due_date is not None:
            payload["due_date"] = due_date
        if tags is not None:
            payload["tags"] = tags
        return await self._request(
            "POST", "/api/v1/tasks", access_token, json=payload
        )

    async def list_tasks(
        self,
        access_token: str,
        *,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        tag: Optional[str] = None,
        overdue: Optional[bool] = None,
        today: Optional[bool] = None,
        upcoming: Optional[bool] = None,
        recurring: Optional[bool] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        params: dict = {"page": page, "page_size": page_size}
        if status is not None:
            params["status"] = status
        if priority is not None:
            params["priority"] = priority
        if tag is not None:
            params["tag"] = tag
        if overdue is not None:
            params["overdue"] = overdue
        if today is not None:
            params["today"] = today
        if upcoming is not None:
            params["upcoming"] = upcoming
        if recurring is not None:
            params["recurring"] = recurring
        return await self._request(
            "GET", "/api/v1/tasks", access_token, params=params
        )

    async def bulk_reschedule_overdue_tasks(
        self,
        access_token: str,
        *,
        new_due_date: str,
        task_ids: Optional[List[str]] = None,
    ) -> dict:
        payload: dict = {"new_due_date": new_due_date}
        if task_ids:
            payload["task_ids"] = task_ids
        return await self._request(
            "POST", "/api/v1/tasks/overdue/reschedule", access_token, json=payload
        )

    async def bulk_complete_overdue_tasks(
        self,
        access_token: str,
        *,
        task_ids: Optional[List[str]] = None,
    ) -> dict:
        payload = {"task_ids": task_ids} if task_ids else None
        return await self._request(
            "POST", "/api/v1/tasks/overdue/complete", access_token, json=payload
        )

    async def update_task(
        self, access_token: str, task_id: str, **fields: Any
    ) -> dict:
        payload = {k: v for k, v in fields.items() if v is not None}
        return await self._request(
            "PATCH", f"/api/v1/tasks/{task_id}", access_token, json=payload
        )

    async def delete_task(self, access_token: str, task_id: str) -> None:
        await self._request(
            "DELETE", f"/api/v1/tasks/{task_id}", access_token
        )

    # -- Meetings --------------------------------------------------------

    async def create_meeting(
        self,
        access_token: str,
        *,
        title: str,
        start_time: str,
        end_time: str,
        description: Optional[str] = None,
        location: Optional[str] = None,
        participants: Optional[List[dict]] = None,
    ) -> dict:
        payload: dict = {
            "title": title,
            "start_time": start_time,
            "end_time": end_time,
        }
        if description is not None:
            payload["description"] = description
        if location is not None:
            payload["location"] = location
        if participants is not None:
            payload["participants"] = participants
        return await self._request(
            "POST", "/api/v1/meetings", access_token, json=payload
        )

    async def list_meetings(
        self,
        access_token: str,
        *,
        status: Optional[str] = None,
        starts_after: Optional[str] = None,
        starts_before: Optional[str] = None,
        overdue: Optional[bool] = None,
        missed: Optional[bool] = None,
        today: Optional[bool] = None,
        upcoming: Optional[bool] = None,
    ) -> dict:
        params: dict = {}
        if status is not None:
            params["status"] = status
        if starts_after is not None:
            params["starts_after"] = starts_after
        if starts_before is not None:
            params["starts_before"] = starts_before
        if overdue is not None:
            params["overdue"] = overdue
        if missed is not None:
            params["missed"] = missed
        if today is not None:
            params["today"] = today
        if upcoming is not None:
            params["upcoming"] = upcoming
        return await self._request(
            "GET", "/api/v1/meetings", access_token, params=params
        )

    async def cancel_meeting(self, access_token: str, meeting_id: str) -> dict:
        return await self._request(
            "POST", f"/api/v1/meetings/{meeting_id}/cancel", access_token
        )

    # -- Reminders -------------------------------------------------------

    async def create_reminder(
        self,
        access_token: str,
        *,
        remind_at: str,
        message: Optional[str] = None,
        task_id: Optional[str] = None,
        meeting_id: Optional[str] = None,
    ) -> dict:
        payload: dict = {"remind_at": remind_at}
        if message is not None:
            payload["message"] = message
        if task_id is not None:
            payload["task_id"] = task_id
        if meeting_id is not None:
            payload["meeting_id"] = meeting_id
        return await self._request(
            "POST", "/api/v1/reminders", access_token, json=payload
        )

    async def list_reminders(
        self, access_token: str, *, is_sent: Optional[bool] = None
    ) -> dict:
        params: dict = {}
        if is_sent is not None:
            params["is_sent"] = is_sent
        return await self._request(
            "GET", "/api/v1/reminders", access_token, params=params
        )

    async def delete_reminder(self, access_token: str, reminder_id: str) -> None:
        await self._request(
            "DELETE", f"/api/v1/reminders/{reminder_id}", access_token
        )
