"use client";
/** Downloads the activity log as a spreadsheet, for record keeping outside the app. */
import { useState, useTransition } from "react";
import { exportActivityAction } from "@/server/actions";

export default function ExportActivity() {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const download = () =>
    start(async () => {
      const res = await exportActivityAction();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError("");
      const url = URL.createObjectURL(new Blob([res.csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.fileName;
      a.click();
      URL.revokeObjectURL(url);
    });

  return (
    <span className="inline-flex items-center gap-2">
      <button className="btn-secondary py-1.5 text-xs" onClick={download} disabled={pending} title="Opens in Excel or Google Sheets">
        {pending ? "Preparing…" : "Download as spreadsheet"}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
