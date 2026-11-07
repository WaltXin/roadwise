"use client";

import { useActionState, useEffect, useId, useRef } from "react";

import { Button } from "@/components/ui/button";
import { saveEntry, type FormState } from "@/lib/knowledge/actions";
import { SECTIONS, type EntryValues, type SectionKey, type SelectOption } from "@/lib/knowledge/sections";

import { FieldControl } from "./field-control";
import { SubmitButton } from "./submit-button";

type Props = {
  sectionKey: SectionKey;
  domainId: string;
  /** Present when editing an existing entry. */
  entry?: EntryValues;
  /** Initial values for a new entry (e.g. the category of the group it was opened from). */
  presets?: Record<string, string>;
  sourceOptions: SelectOption[];
  onDone: () => void;
};

const initialState: FormState = { status: "idle" };

export function EntryForm({ sectionKey, domainId, entry, presets, sourceOptions, onDone }: Props) {
  const section = SECTIONS[sectionKey];
  const [state, action] = useActionState(saveEntry, initialState);
  const idPrefix = useId();
  const firstField = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "success") onDone();
  }, [state, onDone]);

  useEffect(() => {
    firstField.current?.querySelector<HTMLElement>("input, textarea, select")?.focus();
  }, []);

  function valueOf(name: string) {
    if (state.values && name in state.values) return state.values[name];
    const v = entry?.[name];
    if (v !== undefined && v !== null) return String(v);
    return presets?.[name] ?? "";
  }

  return (
    // Re-mount on each failed submission so inputs show the submitted values.
    <form key={state.submittedAt ?? 0} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="_section" value={sectionKey} />
      <input type="hidden" name="_domainId" value={domainId} />
      {entry && <input type="hidden" name="_id" value={entry.id} />}

      <div ref={firstField} className="grid gap-4 sm:grid-cols-2">
        {section.fields.map((field) => (
          <FieldControl
            key={field.name}
            field={field}
            idPrefix={idPrefix}
            defaultValue={valueOf(field.name)}
            error={state.fieldErrors?.[field.name]}
            sourceOptions={sourceOptions}
          />
        ))}
      </div>

      {state.status === "error" && state.message && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <SubmitButton>{entry ? "Save changes" : `Add ${section.singular}`}</SubmitButton>
      </div>
    </form>
  );
}
