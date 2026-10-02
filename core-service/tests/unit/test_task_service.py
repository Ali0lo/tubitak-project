"""Unit tests for task service bulk status and board ordering."""

import uuid
from unittest.mock import AsyncMock

import pytest

from app.models.task import Task, TaskStatus
from app.schemas.task import TaskStateUpdateItem, TaskUpdate
from app.services.task_service import TaskService


def test_task_status_has_review():
    """Verify TaskStatus enum contains 'review'."""
    assert TaskStatus.REVIEW == "review"
    assert TaskStatus.PENDING == "pending"
    assert TaskStatus.IN_PROGRESS == "in_progress"
    assert TaskStatus.COMPLETED == "completed"


def test_task_update_schema_supports_board_order():
    """Verify TaskUpdate accepts board_order and review status."""
    update = TaskUpdate(status=TaskStatus.REVIEW, board_order=5)
    assert update.status == TaskStatus.REVIEW
    assert update.board_order == 5


@pytest.mark.asyncio
async def test_bulk_update_status():
    """Verify bulk_update_status updates multiple tasks."""
    mock_db = AsyncMock()
    service = TaskService(mock_db)

    user_id = uuid.uuid4()
    task1 = Task(id=uuid.uuid4(), user_id=user_id, title="Task 1", status=TaskStatus.PENDING)
    task2 = Task(id=uuid.uuid4(), user_id=user_id, title="Task 2", status=TaskStatus.PENDING)

    service.get_task = AsyncMock(side_effect=[task1, task2])
    service.tasks.update = AsyncMock(side_effect=[task1, task2])
    service.log_activity = AsyncMock()

    result = await service.bulk_update_status(
        user_id,
        [task1.id, task2.id],
        TaskStatus.REVIEW,
    )

    assert len(result) == 2
    assert service.tasks.update.call_count == 2
    assert mock_db.commit.called


@pytest.mark.asyncio
async def test_bulk_update_state():
    """Verify bulk_update_state updates both status and board_order."""
    mock_db = AsyncMock()
    service = TaskService(mock_db)

    user_id = uuid.uuid4()
    task1 = Task(id=uuid.uuid4(), user_id=user_id, title="Task 1", status=TaskStatus.PENDING, board_order=0)

    service.get_task = AsyncMock(return_value=task1)
    service.tasks.update = AsyncMock(return_value=task1)
    service.log_activity = AsyncMock()

    item = TaskStateUpdateItem(task_id=task1.id, status=TaskStatus.IN_PROGRESS, board_order=3)
    result = await service.bulk_update_state(user_id, [item])

    assert len(result) == 1
    service.tasks.update.assert_called_once_with(
        task1,
        status=TaskStatus.IN_PROGRESS,
        board_order=3,
        completed_at=None,
        clear_completed_at=True,
    )
    assert mock_db.commit.called
