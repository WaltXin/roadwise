import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { FieldDef, SelectOption } from "@/lib/knowledge/sections";
import { cn } from "@/lib/utils";

type Props = {
  field: FieldDef;
  idPrefix: string;
  defaultValue?: string;
  error?: string;
  sourceOptions?: SelectOption[];
};

export function FieldControl({ field, idPrefix, defaultValue = "", error, sourceOptions = [] }: Props) {
  const id = `${idPrefix}-${field.name}`;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [field.help && helpId, error && errorId].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    name: field.name,
    defaultValue,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  };

  let control: React.ReactNode;
  let help = field.help;

  switch (field.kind) {
    case "textarea":
      control = <Textarea {...common} rows={3} placeholder={field.placeholder} />;
      break;
    case "text":
    case "url":
      control = (
        <Input
          {...common}
          type={field.kind === "url" ? "url" : "text"}
          required={field.required}
          placeholder={field.placeholder}
        />
      );
      break;
    case "number":
      control = (
        <Input {...common} type="number" inputMode="numeric" min={field.min} step={1} placeholder={field.placeholder} />
      );
      break;
    case "select":
      control = (
        <NativeSelect {...common} defaultValue={defaultValue || field.defaultValue || ""} required={field.required}>
          {(!field.required || !(defaultValue || field.defaultValue)) && (
            <option value="" disabled={field.required}>
              {field.required ? "Choose…" : "—"}
            </option>
          )}
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      );
      break;
    case "source":
      if (sourceOptions.length === 0) help = "Add sources first to cite them here.";
      control = (
        <NativeSelect {...common} disabled={sourceOptions.length === 0}>
          <option value="">No source</option>
          {sourceOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      );
      break;
  }

  return (
    <div className={cn("flex flex-col gap-1.5", field.wide && "sm:col-span-2")}>
      <Label htmlFor={id}>
        {field.label}
        {field.required && (
          <span className="text-muted-foreground" aria-hidden>
            *
          </span>
        )}
      </Label>
      {control}
      {help && !error && (
        <p id={helpId} className="text-xs text-muted-foreground">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
