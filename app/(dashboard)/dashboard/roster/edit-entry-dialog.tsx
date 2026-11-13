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
import { normalizeDiscordUsername } from "@/lib/validation/attendance";
import { rosterEntryEditSchema } from "@/lib/validation/roster";

type EditFormValues = {
  name: string;
  email: string;
  phone: string;
  discordUsername: string;
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
    discordUsername: entry.discordUsername ?? "",
  });
  // Paired with an account that has since left the server: there is no
  // username to show, so the field starts empty even though a pairing exists.
  // Saving it empty must then CLEAR that pairing rather than read as "no
  // change" — otherwise the student stays locked out of the attendance form.
  const hasStalePairing =
    entry.discordUserId !== null && entry.discordUsername === null;
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

    const payload: {
      name?: string;
      email?: string;
      phone?: string | null;
      discordUsername?: string | null;
    } = {};
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
    // Compared after the same normalization the server applies, so retyping
    // the current name with an `@` or different casing is not a change.
    const typedHandle = normalizeDiscordUsername(values.discordUsername);
    if (typedHandle !== (entry.discordUsername ?? "")) {
      payload.discordUsername = typedHandle || null;
    } else if (hasStalePairing && typedHandle === "") {
      // The field's help text says saving it empty clears the stale pairing.
      payload.discordUsername = null;
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

        <Field data-invalid={errors.discordUsername ? true : undefined}>
          <FieldLabel htmlFor="edit-discord-username">Discord username</FieldLabel>
          <Input
            id="edit-discord-username"
            value={values.discordUsername}
            onChange={(e) => setField("discordUsername", e.target.value)}
            aria-invalid={errors.discordUsername ? true : undefined}
            placeholder="rakib_dev"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <FieldDescription>
            {hasStalePairing
              ? "This student is paired with an account that is no longer in the server, so attendance is refused. Enter their current username, or save with this empty to clear the pairing."
              : "The name under the @ on their Discord profile. Attendance is only accepted from this account with the email above. Must be a current server member; leave empty to clear the pairing."}
          </FieldDescription>
          <FieldError>{errors.discordUsername}</FieldError>
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
            Correct the student&apos;s name, email, contact number, or Discord
            username.
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
