import type { ChangeEvent } from "react";

import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { MediaState, PrimarySystem, Scene } from "@mrt/media-state";
import { DateTime, Option, Schema } from "effect";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mediaStateAtom, selectMediaState, setMediaStateAtom } from "@/lib/atom/media-state";
import { makeCard } from "@/lib/cards";

export const MediaControlCard = makeCard({
  id: "media-control-card",
  name: "Media Control",
  schema: Schema.Struct({}),
  component: MediaControlCardContent,
});

function MediaControlCardContent() {
  const state = useAtomValue(mediaStateAtom, selectMediaState);
  const setState = useAtomSet(setMediaStateAtom);

  const handleSceneChange = (value: unknown) => {
    Schema.decodeUnknownOption(Scene)(value).pipe(
      Option.match({
        onNone: () => undefined,
        onSome: (scene) => setState(MediaState.make({ ...state, scene })),
      }),
    );
  };

  const handlePrimarySystemChange = (value: unknown) => {
    Schema.decodeUnknownOption(PrimarySystem)(value).pipe(
      Option.match({
        onNone: () => undefined,
        onSome: (primarySystem) => setState(MediaState.make({ ...state, primarySystem })),
      }),
    );
  };

  const handleRedFlagChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value;

    if (value === "") {
      setState(MediaState.make({ ...state, redFlagAt: null }));
      return;
    }

    DateTime.make(value).pipe(
      Option.match({
        onNone: () => undefined,
        onSome: (redFlagAt) => setState(MediaState.make({ ...state, redFlagAt })),
      }),
    );
  };

  const handleShowTankCardChange = (checked: boolean) => {
    setState(MediaState.make({ ...state, showTankCard: checked }));
  };

  const handleShowGpsCardChange = (checked: boolean) => {
    setState(MediaState.make({ ...state, showGpsCard: checked }));
  };

  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-2 p-2">
      <label htmlFor="media-control-scene">Scene</label>
      <Select value={state.scene} onValueChange={handleSceneChange}>
        <SelectTrigger id="media-control-scene" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Scene</SelectLabel>
            {Scene.literals.map((scene) => (
              <SelectItem key={scene} value={scene}>
                {scene}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <label htmlFor="media-control-primary-system">Primary source</label>
      <Select value={state.primarySystem} onValueChange={handlePrimarySystemChange}>
        <SelectTrigger id="media-control-primary-system" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Primary source</SelectLabel>
            {PrimarySystem.literals.map((system) => (
              <SelectItem key={system} value={system}>
                {system}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <label htmlFor="media-control-red-flag">Red flag time</label>
      <Input
        id="media-control-red-flag"
        type="datetime-local"
        value={formatDateTimeInput(state.redFlagAt)}
        onChange={handleRedFlagChange}
      />
      <label htmlFor="media-control-show-tank-card">Show tank card</label>
      <Checkbox
        id="media-control-show-tank-card"
        checked={state.showTankCard}
        onCheckedChange={handleShowTankCardChange}
      />
      <label htmlFor="media-control-show-gps-card">Show GPS card</label>
      <Checkbox
        id="media-control-show-gps-card"
        checked={state.showGpsCard}
        onCheckedChange={handleShowGpsCardChange}
      />
    </div>
  );
}

function formatDateTimeInput(value: DateTime.Utc | null) {
  if (value === null) return "";

  const date = DateTime.toDate(value);
  const pad = (part: number) => part.toString().padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
