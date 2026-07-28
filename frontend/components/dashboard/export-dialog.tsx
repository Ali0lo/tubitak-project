"use client";

import React, { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Task } from "@/types/task";
import { Meeting } from "@/types/meeting";
import { useExportData } from "@/hooks/use-export-data";
import { Download, FileText, Table } from "lucide-react";

interface ExportDialogProps {
  tasks: Task[];
  meetings: Meeting[];
  stats: Record<string, any>;
}

export function ExportDialog({ tasks, meetings, stats }: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const { exportTasksCSV, exportMeetingsCSV, exportPDFSummary } = useExportData();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-paper border border-paper-line rounded-lg hover:bg-paper-tint text-ink transition-colors shadow-2xs"
      >
        <Download className="h-3.5 w-3.5 text-forest" />
        <span>Export Workspace</span>
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Export Workspace Data"
      >
        <div className="space-y-4">
          <p className="text-xs text-ink-muted leading-relaxed">
            Download your tasks, meeting schedules, and productivity reports in CSV or PDF formats.
          </p>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => {
                exportTasksCSV(tasks);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between p-3 bg-paper-tint hover:bg-paper-line/50 rounded-lg border border-paper-line text-xs font-medium text-ink transition-colors"
            >
              <div className="flex items-center gap-2">
                <Table className="h-4 w-4 text-emerald-600" />
                <span>Export Tasks (CSV)</span>
              </div>
              <span className="font-mono text-[10px] text-ink-muted">{tasks.length} items</span>
            </button>

            <button
              type="button"
              onClick={() => {
                exportMeetingsCSV(meetings);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between p-3 bg-paper-tint hover:bg-paper-line/50 rounded-lg border border-paper-line text-xs font-medium text-ink transition-colors"
            >
              <div className="flex items-center gap-2">
                <Table className="h-4 w-4 text-sky-600" />
                <span>Export Meetings (CSV)</span>
              </div>
              <span className="font-mono text-[10px] text-ink-muted">{meetings.length} items</span>
            </button>

            <button
              type="button"
              onClick={() => {
                exportPDFSummary(tasks, meetings, stats);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between p-3 bg-paper-tint hover:bg-paper-line/50 rounded-lg border border-paper-line text-xs font-medium text-ink transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-600" />
                <span>Productivity Report (PDF)</span>
              </div>
              <span className="font-mono text-[10px] text-ink-muted">Printable</span>
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
