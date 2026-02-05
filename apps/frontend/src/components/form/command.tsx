import { Input } from "@/components/ui/input";
import type { FormFieldRenderer } from "@/lib/form";

export const CommandField: FormFieldRenderer = (title) => {
  return (
    <div>
      <span>{title}</span>
      <Input />
    </div>
  );
};
