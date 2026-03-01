import { useAtom } from "@effect-atom/atom-react";

import type { FormFieldRenderer } from "@/lib/form";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Field, FieldLabel } from "@/components/ui/field";

const frameworks = [
  "Next.js",
  "SvelteKit",
  "Nuxt.js",
  "Remix",
  "Astro",
] as const;

export const ParameterField: FormFieldRenderer = (title, atom) => {
  const [value, setValue] = useAtom(atom);
  return (
    <Field>
      <FieldLabel>{title}</FieldLabel>
      <Combobox
        items={frameworks}
        autoHighlight
        value={value}
        onValueChange={setValue}
      >
        <ComboboxInput placeholder="Select a parameter" />
        <ComboboxContent>
          <ComboboxEmpty>No parameter found.</ComboboxEmpty>
          <ComboboxList>
            {(item) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  );
};
