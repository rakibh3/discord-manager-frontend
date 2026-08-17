"use client";

import { useActionState, useId } from "react";

import { login, type LoginState } from "@/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const INITIAL: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(login, INITIAL);
  const emailId = useId();
  const passwordId = useId();
  const emailErrorId = `${emailId}-error`;
  const passwordErrorId = `${passwordId}-error`;

  const emailError = state.fieldErrors?.email;
  const passwordError = state.fieldErrors?.password;

  return (
    <Card>
      <CardContent>
        <form action={action} noValidate>
          <FieldGroup>
            {/*
              One generic message for both a wrong password (401) and an unknown
              email (404) — different copy would let this form be used to test
              which addresses have accounts.
            */}
            {state.error ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <Field data-invalid={emailError ? true : undefined}>
              <FieldLabel htmlFor={emailId}>Email</FieldLabel>
              <Input
                id={emailId}
                name="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? emailErrorId : undefined}
              />
              {emailError ? (
                <FieldDescription id={emailErrorId}>
                  {emailError}
                </FieldDescription>
              ) : null}
            </Field>

            <Field data-invalid={passwordError ? true : undefined}>
              <FieldLabel htmlFor={passwordId}>Password</FieldLabel>
              <Input
                id={passwordId}
                name="password"
                type="password"
                autoComplete="current-password"
                required
                aria-invalid={passwordError ? true : undefined}
                aria-describedby={passwordError ? passwordErrorId : undefined}
              />
              {passwordError ? (
                <FieldDescription id={passwordErrorId}>
                  {passwordError}
                </FieldDescription>
              ) : null}
            </Field>

            <Field>
              <Button type="submit" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" /> : null}
                {pending ? "Signing in…" : "Sign in"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
