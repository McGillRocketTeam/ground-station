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
import { cardListAtom } from "@/lib/atom/card-registry";
import { Atom, useAtom, useAtomValue } from "@effect-atom/atom-react";

const currentSelectedCardAtom = Atom.make("text");

export function DebugPage() {
  const currentlySelectedCard = useAtomValue(currentSelectedCardAtom);
  const cards = useAtomValue(cardListAtom);
  return (
    <div className="h-screen flex flex-col">
      <DebugToolbar />

      <div className="p-4 grow grid place-items-center">
        {currentlySelectedCard}
      </div>

      <div>{JSON.stringify(cards)}</div>
    </div>
  );
}

export function DebugToolbar() {
  const [currentlySelected, setCurrentlySelected] = useAtom(
    currentSelectedCardAtom,
  );
  return (
    <Menubar className="border-0 border-b">
      <MenubarMenu>
        <MenubarTrigger>Cards</MenubarTrigger>
        <MenubarContent>
          <MenubarRadioGroup
            value={currentlySelected}
            onValueChange={setCurrentlySelected}
          >
            <MenubarRadioItem value="andy">Andy</MenubarRadioItem>
            <MenubarRadioItem value="benoit">Benoit</MenubarRadioItem>
            <MenubarRadioItem value="Luis">Luis</MenubarRadioItem>
          </MenubarRadioGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <MenubarItem inset>Edit...</MenubarItem>
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <MenubarItem inset>Add Profile...</MenubarItem>
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
