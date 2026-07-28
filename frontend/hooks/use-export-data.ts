"use client";

import { Task } from "@/types/task";
import { Meeting } from "@/types/meeting";

export function useExportData() {
  const exportCSV = (filename: string, rows: Record<string, any>[]) => {
    if (!rows || rows.length === 0 || !rows[0]) return;
    const firstRow = rows[0];
    const headers = Object.keys(firstRow);
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const val = row[header] ?? "";
            const escaped = String(val).replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportTasksCSV = (tasks: Task[]) => {
    if (!tasks || tasks.length === 0) return;
    const rows = tasks.map((t) => ({
      ID: t.id,
      Title: t.title,
      Status: t.status,
      Priority: t.priority,
      DueDate: t.due_date ? new Date(t.due_date).toLocaleString() : "",
      IsOverdue: t.is_overdue ? "Yes" : "No",
      IsRecurring: t.is_recurring ? "Yes" : "No",
      CompletedAt: t.completed_at ? new Date(t.completed_at).toLocaleString() : "",
      CreatedAt: new Date(t.created_at).toLocaleString(),
    }));
    exportCSV("todotak-tasks-export", rows);
  };

  const exportMeetingsCSV = (meetings: Meeting[]) => {
    if (!meetings || meetings.length === 0) return;
    const rows = meetings.map((m) => {
      const start = new Date(m.start_time).getTime();
      const end = new Date(m.end_time).getTime();
      const durationMins = Math.max(15, Math.round((end - start) / (1000 * 60)));
      return {
        ID: m.id,
        Title: m.title,
        Status: m.status,
        StartTime: new Date(m.start_time).toLocaleString(),
        EndTime: new Date(m.end_time).toLocaleString(),
        DurationMinutes: durationMins,
        JoinUrl: m.meeting_link || "",
      };
    });
    exportCSV("todotak-meetings-export", rows);
  };

  const exportPDFSummary = (tasks: Task[], meetings: Meeting[], stats: Record<string, any>) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Todotak Productivity Summary Report</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 32px; color: #1e293b; }
            h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
            h2 { margin-top: 24px; color: #334155; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 16px 0; }
            .card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; }
            .val { font-size: 24px; font-weight: bold; color: #0284c7; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; font-size: 13px; }
            th { background: #f1f5f9; }
          </style>
        </head>
        <body>
          <h1>Todotak Workspace Productivity Report</h1>
          <p>Generated on ${new Date().toLocaleString()}</p>
          
          <h2>Summary Metrics</h2>
          <div class="grid">
            <div class="card">
              <div>Total Tasks</div>
              <div class="val">${tasks.length}</div>
            </div>
            <div class="card">
              <div>Completed Tasks</div>
              <div class="val">${stats.totalCompleted ?? 0}</div>
            </div>
            <div class="card">
              <div>Completion Rate</div>
              <div class="val">${stats.completionRate ?? 0}%</div>
            </div>
          </div>

          <h2>Recent Tasks</h2>
          <table>
            <thead>
              <tr><th>Title</th><th>Priority</th><th>Status</th><th>Due Date</th></tr>
            </thead>
            <tbody>
              ${tasks.slice(0, 15).map((t) => `
                <tr>
                  <td>${t.title}</td>
                  <td>${t.priority}</td>
                  <td>${t.status}</td>
                  <td>${t.due_date ? new Date(t.due_date).toLocaleDateString() : "-"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return { exportTasksCSV, exportMeetingsCSV, exportPDFSummary };
}
