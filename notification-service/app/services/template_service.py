"""Template service for constructing rendered email objects."""
from typing import Optional

from app.templates.notification_email import RenderedEmail, render_reminder_email


class TemplateService:
    """Service for managing and rendering notification email templates."""

    @staticmethod
    def render_reminder(message: str, subject: Optional[str] = None) -> RenderedEmail:
        """Render a reminder email template."""
        content = render_reminder_email(message)
        if subject:
            content.subject = subject
        return content

    @staticmethod
    def render_notification(message: str, title: Optional[str] = None) -> RenderedEmail:
        """Render a generic notification email template."""
        content = render_reminder_email(message)
        if title:
            content.subject = title
        return content
