"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { login as loginRequest, logout as logoutRequest } from "@/lib/api/endpoints/auth";
import { clearSession, readSession, writeSession } from "@/lib/auth/session";

export type LoginState = {
  error?: string;
  fieldErrors?: Partial<Record<"email" | "password", string>>;
};

const loginSchema = z.object({
  email: z.email({ error: "Enter a valid email address." }),
  password: z.string().min(1, { error: "Enter your password." }),
});

/** Server Zod messages arrive Title Cased ("Enter A Valid Email"), so map issue
 *  paths to our own copy and keep the server text only as a fallback. */
const FIELD_COPY: Record<string, string> = {
  email: "Enter a valid email address.",
  password: "Enter your password.",
};

function mapFieldErrors(error: ApiError): LoginState["fieldErrors"] {
  const mapped: Record<string, string> = {};
  for (const [field, serverMessage] of Object.entries(error.fieldErrors())) {
    mapped[field] = FIELD_COPY[field] ?? serverMessage;
  }
  return mapped;
}

export async function login(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    const fieldErrors: LoginState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "email" || field === "password") {
        fieldErrors[field] ??= issue.message;
      }
    }
    return { fieldErrors };
  }

  try {
    const tokens = await loginRequest(parsed.data);
    await writeSession(tokens);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.isValidation) return { fieldErrors: mapFieldErrors(error) };

      // 401 is a wrong password and 404 is an unknown email. Rendering
      // different copy would turn this form into an account-enumeration oracle.
      if (error.status === 401 || error.status === 404) {
        return { error: "Incorrect email or password." };
      }

      // 403 covers a suspended account and a non-ADMIN role. Those messages are
      // written for humans and tell the admin what to do, so pass them through.
      if (error.status === 403) return { error: error.message };

      if (error.isNetwork) {
        return { error: "Could not reach the server. Check that the API is running, then try again." };
      }

      return { error: error.message };
    }
    throw error;
  }

  // Outside the try — `redirect()` works by throwing, so a catch would swallow it.
  redirect("/dashboard");
}

/** Best-effort server-side, unconditional client-side: cookies are cleared and
 *  the user lands on `/login-admin` even if the backend call fails. */
export async function logout(): Promise<never> {
  try {
    const { refreshToken } = await readSession();
    await logoutRequest(refreshToken);
  } catch {
    // Best effort — the backend row may outlive the session. Not a user problem.
  }

  await clearSession();
  redirect("/login-admin");
}
