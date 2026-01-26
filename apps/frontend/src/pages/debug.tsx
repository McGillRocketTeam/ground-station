import { Form } from "@/components/form";
import {
  Menubar,
  MenubarContent,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarTrigger,
} from "@/components/ui/menubar";
import {
  CardArray,
  CardComponentMap,
  CardSchemaMap,
  type CardId,
} from "@/lib/cards";
import { Atom, useAtom, useAtomValue } from "@effect-atom/atom-react";
import { useState } from "react";

const selectedCardAtom = Atom.make<CardId>("text-card");
const selectedSchemaAtom = Atom.map(
  selectedCardAtom,
  (id) => CardSchemaMap[id],
);
const selectedComponentAtom = Atom.map(
  selectedCardAtom,
  (id) => CardComponentMap[id],
);

export function DebugPage() {
  const selectedSchema = useAtomValue(selectedSchemaAtom);
  const selectedComponent = useAtomValue(selectedComponentAtom);

  return (
    <div className="grid h-screen grid-cols-[4fr_minmax(300px,1fr)] grid-rows-[auto_1fr]">
      <DebugToolbar />

      <div className="p-4 grid place-items-center">
        {selectedComponent ? (
          <div>
            {selectedComponent({ parameter: "Hello World", command: "test" })}
          </div>
        ) : (
          <div className="text-muted-foreground">No Card Selected</div>
        )}
      </div>

      <aside className="border-l p-2">
        {selectedSchema && <Form schemaAtom={selectedSchemaAtom} />}
      </aside>
    </div>
  );
}

export function DebugToolbar() {
  const [currentlySelected, setCurrentlySelected] = useAtom(selectedCardAtom);
  const [open, setOpen] = useState(false);
  return (
    <Menubar className="border-0 border-b col-span-full">
      <MenubarMenu open={open} onOpenChange={setOpen}>
        <MenubarTrigger>Cards</MenubarTrigger>
        <MenubarContent>
          <MenubarRadioGroup
            value={currentlySelected}
            onValueChange={(value) => {
              setOpen(false);
              setCurrentlySelected(value);
            }}
          >
            {CardArray.map((card) => (
              <MenubarRadioItem key={card.id} value={card.id}>
                {card.name}
              </MenubarRadioItem>
            ))}
          </MenubarRadioGroup>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
