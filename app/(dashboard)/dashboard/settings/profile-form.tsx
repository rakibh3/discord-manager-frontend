"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { updateProfile, type ProfileState } from "@/actions/profile";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { AdminUser } from "@/lib/api/types";
import { BIO_MAX_LENGTH } from "@/lib/validation/profile";

const INITIAL: ProfileState = {};

export function ProfileForm({ admin }: { admin: AdminUser }) {
  const [state, action, pending] = useActionState(updateProfile, INITIAL);
  const [bio, setBio] = useState("");

  const nameId = useId();
  const emailId = useId();
  const photoId = useId();
  const bioId = useId();

  useEffect(() => {
    if (state.success) toast.success("Profile saved.");
  }, [state.success]);

  const fieldError = (field: string) => state.fieldErrors?.[field];

  return (
    <form action={action} noValidate>
      <FieldGroup>
        {state.error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <Field data-invalid={fieldError("name") ? true : undefined}>
          <FieldLabel htmlFor={nameId}>Name</FieldLabel>
          <Input
            id={nameId}
            name="name"
            defaultValue={admin.name}
            autoComplete="name"
            aria-invalid={fieldError("name") ? true : undefined}
            aria-describedby={`${nameId}-hint`}
          />
          <FieldDescription id={`${nameId}-hint`}>
            {fieldError("name") ?? "Between 2 and 100 characters."}
          </FieldDescription>
        </Field>

        <Field data-invalid={fieldError("email") ? true : undefined}>
          <FieldLabel htmlFor={emailId}>Email</FieldLabel>
          <Input
            id={emailId}
            name="email"
            type="email"
            defaultValue={admin.email}
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={fieldError("email") ? true : undefined}
            aria-describedby={`${emailId}-hint`}
          />
          <FieldDescription id={`${emailId}-hint`}>
            {fieldError("email") ??
              "This is the address you sign in with."}
          </FieldDescription>
        </Field>

        <Field data-invalid={fieldError("profilePhoto") ? true : undefined}>
          <FieldLabel htmlFor={photoId}>Profile photo URL</FieldLabel>
          <Input
            id={photoId}
            name="profilePhoto"
            type="url"
            placeholder="https://…"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={fieldError("profilePhoto") ? true : undefined}
            aria-describedby={`${photoId}-hint`}
          />
          <FieldDescription id={`${photoId}-hint`}>
            {fieldError("profilePhoto") ??
              "A full image URL. Leave blank to keep the current photo."}
          </FieldDescription>
        </Field>

        <Field data-invalid={fieldError("bio") ? true : undefined}>
          <FieldLabel htmlFor={bioId}>Bio</FieldLabel>
          <Textarea
            id={bioId}
            name="bio"
            rows={3}
            maxLength={BIO_MAX_LENGTH}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            aria-invalid={fieldError("bio") ? true : undefined}
            aria-describedby={`${bioId}-hint`}
          />
          <FieldDescription id={`${bioId}-hint`}>
            {fieldError("bio") ??
              `${bio.length} of ${BIO_MAX_LENGTH} characters.`}
          </FieldDescription>
        </Field>

        <Field orientation="horizontal">
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
