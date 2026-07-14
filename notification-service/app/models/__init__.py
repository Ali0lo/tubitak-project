"""ORM models package.

Every model is imported here so that Base.metadata is fully populated
when Alembic (or anything else) imports app.models.
"""
from app.models.notification import Notification, NotificationStatus
from app.models.notification_preference import NotificationPreference

__all__ = ["Notification", "NotificationStatus", "NotificationPreference"]
