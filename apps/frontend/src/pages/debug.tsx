import {
  Menubar,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
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

const selectedCardAtom = Atom.make<CardId | undefined>(undefined);

export function DebugPage() {
  const selectedCardId = useAtomValue(selectedCardAtom);
  const selectedCardSchema = selectedCardId
    ? CardSchemaMap[selectedCardId]
    : undefined;
  const selectedCard = selectedCardId
    ? CardComponentMap[selectedCardId]
    : undefined;

  return (
    <div className="grid h-screen grid-cols-[4fr_minmax(300px,1fr)] grid-rows-[auto_1fr]">
      <DebugToolbar />

      <div className="p-4 grid place-items-center">
        {selectedCard ? (
          <div>{selectedCard({ text: "Hello World" })}</div>
        ) : (
          <div className="text-muted-foreground">No Card Selected</div>
        )}
      </div>

      <aside className="border-l">{/* form from schema */}</aside>
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
