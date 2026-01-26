import type { FormFieldRenderer } from "@/lib/form";
import { Input } from "@/components/ui/input";

export const CommandField: FormFieldRenderer = (title) => {
  return (
    <div>
      <span>{title}</span>
      <Input />
    </div>
  );
};
