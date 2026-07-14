"""Renders subject/HTML/plain-text bodies for notification emails.

Kept as plain Python string building rather than a full templating
engine — the content here is a single short notice, not a document,
so the added dependency and indirection of Jinja2 wouldn't earn its
keep.
"""
from dataclasses import dataclass


@dataclass
class RenderedEmail:
    subject: str
    html_body: str
    text_body: str


def render_reminder_email(message: str) -> RenderedEmail:
    subject = "Todotak reminder"
    text_body = f"{message}\n\n— Todotak"
    html_body = f"""\
<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, sans-serif; background:#F5F6F3; padding:24px;">
    <table role="presentation" width="100%" style="max-width:480px; margin:0 auto; background:#FFFFFF; border:1px solid #E4E6E1; border-radius:4px;">
      <tr>
        <td style="padding:24px;">
          <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:#8A9A8E;">
            Todotak reminder
          </p>
          <p style="margin:0; font-size:16px; line-height:1.5; color:#20241F;">
            {message}
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
"""
    return RenderedEmail(subject=subject, html_body=html_body, text_body=text_body)
