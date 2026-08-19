"use client";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Info,
  RotateCcw,
  UploadCloud,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { OutcomeTile } from "./outcome-tile";
import { importRosterFile } from "@/actions/roster";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RosterImportResult } from "@/lib/api/types";

const COLUMN_RULES = [
  {
    field: "Email",
    requirement: "required",
    headers: ["email", "email address", "e-mail", "mail"],
  },
  {
    field: "Name",
    requirement: "required",
    headers: ["name", "full name", "student name", "fullname"],
  },
  {
    field: "Phone",
    requirement: "optional",
    headers: ["phone", "phone number", "mobile", "contact"],
  },
];

export function ImportRosterDialog({
  open,
  onOpenChange,
  onImportComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: (result: RosterImportResult) => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [importResult, setImportResult] = useState<RosterImportResult | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetState = () => {
    setSelectedFile(null);
    setIsUploading(false);
    setDragOver(false);
    setImportResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  };

  const handleFileSelect = (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".csv")) {
      setErrorMessage(
        name.endsWith(".xls")
          ? "Legacy binary .xls is not supported. Save the file as .xlsx or .csv and try again."
          : "Select an Excel (.xlsx) or CSV (.csv) file.",
      );
      return;
    }
    setSelectedFile(file);
    setErrorMessage(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || isUploading) return;

    setIsUploading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    const res = await importRosterFile(formData);
    setIsUploading(false);

    if (res.ok) {
      setImportResult(res.data);
      toast.success(res.message);
      router.refresh();
      onImportComplete?.(res.data);
    } else {
      setErrorMessage(res.message);
      toast.error("Import failed", { description: res.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-4" aria-hidden />
            Import enrolment roster
          </DialogTitle>
          <DialogDescription>
            Upload an Excel (.xlsx) or CSV spreadsheet to populate or update the
            student roll.
          </DialogDescription>
        </DialogHeader>

        {importResult ? (
          <div className="flex flex-col gap-4">
            <Alert variant="success">
              <CheckCircle2 aria-hidden />
              <AlertTitle>Import complete</AlertTitle>
              <AlertDescription>
                Processed {importResult.fileName} &mdash;{" "}
                {importResult.totalRows.toLocaleString()} rows.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <OutcomeTile label="Total rows" value={importResult.totalRows} />
              <OutcomeTile
                label="Created"
                value={importResult.created}
                tone="success"
              />
              <OutcomeTile
                label="Updated"
                value={importResult.updated}
                tone="info"
              />
              <OutcomeTile
                label="Skipped"
                value={importResult.skipped}
                tone="warning"
              />
            </div>

            {importResult.duplicateRowsCollapsed > 0 ? (
              <p className="text-muted-foreground text-sm">
                {importResult.duplicateRowsCollapsed.toLocaleString()} duplicate
                row(s) within the sheet were merged using the latest occurrence.
              </p>
            ) : null}

            {importResult.duplicateAddresses &&
            importResult.duplicateAddresses.length > 0 ? (
              <Alert variant="warning">
                <AlertTriangle aria-hidden />
                <AlertTitle>Duplicate emails in the spreadsheet</AlertTitle>
                <AlertDescription>
                  These addresses appeared more than once. The last row in the
                  sheet was kept.
                  <ul className="max-h-24 list-disc overflow-y-auto pl-5">
                    {importResult.duplicateAddresses.map((dup) => (
                      <li key={dup.email}>
                        <code className="font-mono text-xs">{dup.email}</code>{" "}
                        on rows {dup.rowNumbers.join(", ")}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}

            {importResult.rejectedRows &&
            importResult.rejectedRows.length > 0 ? (
              <section className="flex flex-col gap-2">
                <h3 className="text-destructive flex items-center gap-1.5 text-sm font-medium">
                  <AlertCircle className="size-4" aria-hidden />
                  Skipped rows ({importResult.rejectedRows.length}) &mdash; fix
                  them in the sheet and re-upload
                </h3>
                <div className="max-h-40 overflow-y-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-20">Row</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.rejectedRows.map((rej) => (
                        <TableRow key={`${rej.rowNumber}-${rej.reason}`}>
                          <TableCell className="text-muted-foreground font-mono text-xs">
                            {rej.rowNumber}
                          </TableCell>
                          <TableCell className="text-destructive">
                            {rej.reason}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            ) : null}

            <DialogFooter className="sm:justify-between">
              <Button variant="outline" size="sm" onClick={resetState}>
                <RotateCcw data-icon="inline-start" aria-hidden />
                Upload another file
              </Button>
              <Button size="sm" onClick={() => handleClose(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* A `label` wrapping a screen-reader-only file input, not a `div`
             *  with `onClick`: this way the drop zone is reachable by Tab, opens
             *  on Enter/Space, and shows a focus ring — none of which a clickable
             *  div does. Drag-and-drop stays as the pointer shortcut. */}
            <label
              htmlFor={fileInputId}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : selectedFile
                    ? "border-success/50 bg-success/5"
                    : "hover:border-primary/50 hover:bg-muted/40"
              }`}
            >
              <input
                ref={fileInputRef}
                id={fileInputId}
                type="file"
                accept=".xlsx,.csv"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />

              {selectedFile ? (
                <>
                  <span className="bg-success/10 text-success flex size-10 items-center justify-center rounded-full">
                    <FileSpreadsheet className="size-5" aria-hidden />
                  </span>
                  <span className="text-sm font-medium">
                    {selectedFile.name}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {(selectedFile.size / 1024).toFixed(1)} KB &middot; choose
                    another file
                  </span>
                </>
              ) : (
                <>
                  <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
                    <UploadCloud className="size-5" aria-hidden />
                  </span>
                  <span className="text-sm font-medium">
                    Choose an Excel (.xlsx) or CSV file, or drag one here
                  </span>
                  <span className="text-muted-foreground text-xs">
                    Up to 20,000 rows &middot; 5 MB
                  </span>
                </>
              )}
            </label>

            {errorMessage ? (
              <Alert variant="destructive">
                <AlertCircle aria-hidden />
                <AlertTitle>Upload error</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}

            <section className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-3">
              <h3 className="flex items-center gap-1.5 text-sm font-medium">
                <Info className="size-4" aria-hidden />
                Column headers are matched automatically, case-insensitively
              </h3>
              <dl className="grid gap-2 sm:grid-cols-3">
                {COLUMN_RULES.map((rule) => (
                  <div
                    key={rule.field}
                    className="bg-background rounded-md border p-2"
                  >
                    <dt className="text-sm font-medium">
                      {rule.field}{" "}
                      <span className="text-muted-foreground font-normal">
                        ({rule.requirement})
                      </span>
                    </dt>
                    <dd className="text-muted-foreground mt-0.5 font-mono text-xs">
                      {rule.headers.join(", ")}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="text-muted-foreground text-sm">
                Re-uploading updates existing students by email and never
                removes or deactivates anyone. Re-importing a deactivated
                student reinstates them.
              </p>
            </section>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploading}
                onClick={() => handleClose(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!selectedFile || isUploading}
              >
                {isUploading ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Importing&hellip;
                  </>
                ) : (
                  <>
                    <UploadCloud data-icon="inline-start" aria-hidden />
                    Upload and import
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
