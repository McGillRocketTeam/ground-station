import type { IDockviewHeaderActionsProps } from "dockview-react";

import { PlusIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { CardArray } from "@/lib/cards";
import { cn } from "@/lib/utils";

import { Button } from "../ui/button";
import { DashboardCardForm } from "./form/card-form";

function AddCardDialog({
  open,
  onOpenChange,
  props,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  props: IDockviewHeaderActionsProps;
}) {
  const [selectedCard, setSelectedCard] = useState<
    (typeof CardArray)[number] | null
  >(CardArray[0] ?? null);

  useEffect(() => {
    if (open) {
      setSelectedCard(CardArray[0] ?? null);
    }
  }, [open]);

  const selectedCardName = useMemo(
    () => selectedCard?.name ?? "",
    [selectedCard],
  );

  return (
    <Dialog
      disablePointerDismissal
      open={open}
      onOpenChange={(nextOpen, details) => {
        if (!nextOpen && details.reason === "escape-key") {
          details.cancel();
          return;
        }

        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Add Card</DialogTitle>
          <DialogDescription>
            Choose a card type, then configure its title and settings.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel>Component</FieldLabel>
            <Combobox<(typeof CardArray)[number]>
              autoHighlight
              items={CardArray}
              value={selectedCard}
              itemToStringLabel={(item) => item.name}
              itemToStringValue={(item) => item.id}
              isItemEqualToValue={(item, value) => item.id === value.id}
              onValueChange={(value) => setSelectedCard(value)}
            >
              <ComboboxInput placeholder="Select a card component" />
              <ComboboxContent>
                <ComboboxEmpty>No card component found.</ComboboxEmpty>
                <ComboboxList>
                  {(card: (typeof CardArray)[number]) => (
                    <ComboboxItem key={card.id} value={card}>
                      {card.name}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </Field>
        </FieldGroup>

        {selectedCard ? (
          <DashboardCardForm
            key={selectedCard.id}
            cardId={selectedCard.id}
            formId="add-panel-form"
            initialTitle={selectedCardName}
            onSubmit={({ title, params }) => {
              props.containerApi.addPanel({
                component: selectedCard.id,
                id: crypto.randomUUID(),
                params,
                position: {
                  direction: "within",
                  referenceGroup: props.group,
                },
                title: title || selectedCard.name,
              });
              onOpenChange(false);
            }}
          />
        ) : null}

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button disabled={!selectedCard} form="add-panel-form" type="submit">
            Add card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DashboardPlus(props: IDockviewHeaderActionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className={cn(
          "grid aspect-square h-full place-items-center focus-visible:border focus-visible:outline-none",
        )}
        onClick={() => setOpen(true)}
        type="button"
      >
        <PlusIcon className="size-4" />
      </button>

      <AddCardDialog open={open} onOpenChange={setOpen} props={props} />
    </>
  );
}
