"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId } from "react";

import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { dhakaToday } from "@/lib/dhaka-date";

/**
 * Date selector for daily analytics — reflected in the URL.
 */
export function DateFilter({ date }: { date: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const dateId = useId();

  const setDate = (newDate: string) => {
    const next = new URLSearchParams(params.toString());
    if (newDate) next.set("date", newDate);
    else next.delete("date");
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <FieldGroup className="sm:flex-row sm:items-end sm:gap-3">
      <Field className="sm:w-auto">
        <FieldLabel htmlFor={dateId}>Date</FieldLabel>
        <Input
          id={dateId}
          type="date"
          value={date}
          max={dhakaToday()}
          onChange={(event) => setDate(event.target.value)}
          className="w-auto"
        />
      </Field>
    </FieldGroup>
  );
}
