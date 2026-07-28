"""Unit and integration tests for Task Details Drawer backend features.

Tests subtask CRUD/reorder, activity timeline, and comments thread.
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

TASK_PAYLOAD = {
    "title": "Task for Drawer Features",
    "description": "Details drawer integration tests",
    "priority": "high",
}


async def test_subtask_crud_and_reorder(client: AsyncClient, auth_headers: dict) -> None:
    # 1. Create Task
    task_res = await client.post("/api/v1/tasks", json=TASK_PAYLOAD, headers=auth_headers)
    assert task_res.status_code == 201
    task_id = task_res.json()["id"]

    # 2. Add Subtasks
    st1_res = await client.post(
        f"/api/v1/tasks/{task_id}/subtasks",
        json={"title": "Subtask 1", "completed": False},
        headers=auth_headers,
    )
    assert st1_res.status_code == 201
    st1 = st1_res.json()
    assert st1["title"] == "Subtask 1"

    st2_res = await client.post(
        f"/api/v1/tasks/{task_id}/subtasks",
        json={"title": "Subtask 2", "completed": False},
        headers=auth_headers,
    )
    assert st2_res.status_code == 201
    st2 = st2_res.json()

    # 3. List Subtasks
    list_res = await client.get(f"/api/v1/tasks/{task_id}/subtasks", headers=auth_headers)
    assert list_res.status_code == 200
    subtasks = list_res.json()
    assert len(subtasks) == 2

    # 4. Update Subtask
    patch_res = await client.patch(
        f"/api/v1/tasks/{task_id}/subtasks/{st1['id']}",
        json={"completed": True},
        headers=auth_headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["completed"] is True

    # 5. Reorder Subtasks
    reorder_res = await client.post(
        f"/api/v1/tasks/{task_id}/subtasks/reorder",
        json={"subtask_ids": [st2["id"], st1["id"]]},
        headers=auth_headers,
    )
    assert reorder_res.status_code == 200
    reordered = reorder_res.json()
    assert reordered[0]["id"] == st2["id"]

    # 6. Delete Subtask
    del_res = await client.delete(
        f"/api/v1/tasks/{task_id}/subtasks/{st1['id']}", headers=auth_headers
    )
    assert del_res.status_code == 204


async def test_task_activity_timeline(client: AsyncClient, auth_headers: dict) -> None:
    # 1. Create Task
    task_res = await client.post("/api/v1/tasks", json=TASK_PAYLOAD, headers=auth_headers)
    task_id = task_res.json()["id"]

    # 2. Add subtask to generate activity log
    await client.post(
        f"/api/v1/tasks/{task_id}/subtasks",
        json={"title": "Audit Activity Subtask"},
        headers=auth_headers,
    )

    # 3. Get Activities
    act_res = await client.get(f"/api/v1/tasks/{task_id}/activities", headers=auth_headers)
    assert act_res.status_code == 200
    activities = act_res.json()
    assert len(activities) >= 1
    actions = [a["action"] for a in activities]
    assert "subtask_added" in actions


async def test_task_comments_thread(client: AsyncClient, auth_headers: dict) -> None:
    # 1. Create Task
    task_res = await client.post("/api/v1/tasks", json=TASK_PAYLOAD, headers=auth_headers)
    task_id = task_res.json()["id"]

    # 2. Post Comment
    comment_res = await client.post(
        f"/api/v1/tasks/{task_id}/comments",
        json={"message": "This is a test comment", "author_name": "Alice"},
        headers=auth_headers,
    )
    assert comment_res.status_code == 201
    c_body = comment_res.json()
    assert c_body["message"] == "This is a test comment"
    assert c_body["author_name"] == "Alice"

    # 3. List Comments
    list_res = await client.get(f"/api/v1/tasks/{task_id}/comments", headers=auth_headers)
    assert list_res.status_code == 200
    comments = list_res.json()
    assert len(comments) == 1
    assert comments[0]["message"] == "This is a test comment"
