"use client";

import { AlertCircle, Check, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { editRosterEntry } from "@/actions/roster";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { RosterEntry } from "@/lib/api/types";
import { rosterEntryEditSchema } from "@/lib/validation/roster";

type EditFormValues = {
  name: string;
  email: string;
  phone: string;
};

function EditEntryForm({
  entry,
  onClose,
  onSuccess,
}: {
  entry: RosterEntry;
  onClose: () => void;
  onSuccess?: (updated: RosterEntry) => void;
}) {
  const [values, setValues] = useState<EditFormValues>({
    name: entry.name,
    email: entry.email,
    phone: entry.phone ?? "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof EditFormValues, string>>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const setField = (field: keyof EditFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setGeneralError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const payload: { name?: string; email?: string; phone?: string | null } = {};
    if (values.name.trim() !== entry.name) {
      payload.name = values.name.trim();
    }
    if (values.email.trim().toLowerCase() !== entry.email.toLowerCase()) {
      payload.email = values.email.trim().toLowerCase();
    }
    const currentPhone = values.phone.trim() || null;
    if (currentPhone !== entry.phone) {
      payload.phone = currentPhone;
    }

    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    const parseResult = rosterEntryEditSchema.safeParse(payload);
    if (!parseResult.success) {
      const fieldErrors: Partial<Record<keyof EditFormValues, string>> = {};
      for (const issue of parseResult.error.issues) {
        const field = issue.path[0] as keyof EditFormValues;
        if (field) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setIsSaving(true);
    setGeneralError(null);

    const res = await editRosterEntry(entry.id, parseResult.data);
    setIsSaving(false);

    if (res.ok) {
      toast.success(res.message);
      onSuccess?.(res.data);
      onClose();
    } else {
      setGeneralError(res.message);
      toast.error("Could not update student", { description: res.message });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {generalError ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <Field data-invalid={errors.name ? true : undefined}>
          <FieldLabel htmlFor="edit-name">Full name</FieldLabel>
          <Input
            id="edit-name"
            value={values.name}
            onChange={(e) => setField("name", e.target.value)}
            aria-invalid={errors.name ? true : undefined}
            required
            autoFocus
          />
          <FieldDescription>
            Full name of the enrolled student.
          </FieldDescription>
          {/* `FieldError` carries `role="alert"`, so a validation message is
           *  announced instead of quietly replacing the help text. */}
          <FieldError>{errors.name}</FieldError>
        </Field>

        <Field data-invalid={errors.email ? true : undefined}>
          <FieldLabel htmlFor="edit-email">Enrolment email</FieldLabel>
          <Input
            id="edit-email"
            type="email"
            value={values.email}
            onChange={(e) => setField("email", e.target.value)}
            aria-invalid={errors.email ? true : undefined}
            placeholder="student@example.com"
            required
          />
          <FieldDescription>
            The exact address used at admission — this is what the gate checks.
          </FieldDescription>
          <FieldError>{errors.email}</FieldError>
        </Field>

        <Field data-invalid={errors.phone ? true : undefined}>
          <FieldLabel htmlFor="edit-phone">Phone number</FieldLabel>
          <Input
            id="edit-phone"
            type="tel"
            value={values.phone}
            onChange={(e) => setField("phone", e.target.value)}
            aria-invalid={errors.phone ? true : undefined}
            placeholder="01711000000"
          />
          <FieldDescription>
            Optional. Bangladeshi mobile number, or leave empty to clear it.
          </FieldDescription>
          <FieldError>{errors.phone}</FieldError>
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isSaving}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? (
            <>
              <Spinner data-icon="inline-start" />
              Saving&hellip;
            </>
          ) : (
            <>
              <Check data-icon="inline-start" aria-hidden />
              Save details
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditEntryDialog({
  entry,
  open,
  onOpenChange,
  onSuccess,
}: {
  entry: RosterEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (updated: RosterEntry) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4" aria-hidden />
            Edit student details
          </DialogTitle>
          <DialogDescription>
            Correct the student&apos;s name, email, or contact number.
          </DialogDescription>
        </DialogHeader>

        {entry && (
          <EditEntryForm
            key={entry.id}
            entry={entry}
            onClose={() => onOpenChange(false)}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
