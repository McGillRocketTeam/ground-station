import { FormField, formType, formTitle } from "@/lib/form";
import { Button } from "@/components/ui/button";
import { Atom, useAtomValue } from "@effect-atom/atom-react";
import { Option } from "effect";
import type { CardId, CardSchemaMap } from "@/lib/cards";

const formDataAtom = Atom.make<Record<string, unknown>>({});

// Create a family of atoms for each field
const formFieldAtom = Atom.family((fieldKey: string) =>
  Atom.writable<any | undefined, string>(
    (get) => Option.getOrUndefined(get.self()),
    (ctx, value) => {
      const formData = ctx.get(formDataAtom);
      formData[fieldKey] = value;
      ctx.set(formDataAtom, formData);
      ctx.setSelf(value);
    },
  ),
);

export function Form({
  schemaAtom,
}: {
  schemaAtom: Atom.Writable<(typeof CardSchemaMap)[CardId], CardId>;
}) {
  const schema = useAtomValue(schemaAtom);
  const formData = useAtomValue(formDataAtom);

  if (!schema) return null;

  return (
    <form
      className="space-y-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        console.log(formData);
      }}
    >
      {Object.entries(schema.fields).map(([key, value]) => (
        <FormField
          key={key}
          type={formType(value)}
          title={formTitle(value)}
          atom={formFieldAtom(key)}
        />
      ))}

      <Button type="submit">Submit</Button>
    </form>
  );
}
