"use client";

import React, { useState } from "react";
import { Block } from "@/types/block";
import { Plus } from "lucide-react";

interface TableBlockProps {
  block: Block;
  onChange: (tableData: string[][]) => void;
  onFocus: () => void;
}

export function TableBlock({ block, onChange, onFocus }: TableBlockProps) {
  const tableData: string[][] = block.properties?.tableData || [
    ["Header 1", "Header 2", "Header 3"],
    ["Cell 1", "Cell 2", "Cell 3"],
  ];

  const handleCellChange = (rowIndex: number, colIndex: number, val: string) => {
    const next = tableData.map((row, r) =>
      row.map((cell, c) => (r === rowIndex && c === colIndex ? val : cell))
    );
    onChange(next);
  };

  const addRow = () => {
    const cols = tableData[0]?.length || 3;
    const newRow = new Array(cols).fill("");
    onChange([...tableData, newRow]);
  };

  const addCol = () => {
    const next = tableData.map((row) => [...row, ""]);
    onChange(next);
  };

  return (
    <div className="my-3 overflow-x-auto" onClick={onFocus}>
      <div className="inline-block min-w-full align-middle">
        <table className="border-collapse border border-slate-200 dark:border-slate-800 text-sm">
          <tbody>
            {tableData.map((row, r) => (
              <tr key={r} className={r === 0 ? "bg-slate-50 dark:bg-slate-900/50 font-medium" : ""}>
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className="border border-slate-200 dark:border-slate-800 p-2 min-w-[100px] outline-none"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleCellChange(r, c, e.currentTarget.innerText)}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Row</span>
          </button>
          <span className="text-slate-300">·</span>
          <button
            type="button"
            onClick={addCol}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Column</span>
          </button>
        </div>
      </div>
    </div>
  );
}
