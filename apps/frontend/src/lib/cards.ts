import { Schema } from "effect";
import type { ReactNode } from "react";
import { TextCard } from "@/cards/text-card";
import { ParameterCard } from "@/cards/parameter-card";

export interface CardDefinition<
  Id extends string,
  T extends Schema.Struct.Fields,
> {
  id: Id;
  name: string;
  schema: Schema.Struct<T>;
  component: (props: Schema.Schema.Type<Schema.Struct<T>>) => ReactNode;
}

export function makeCard<
  const Id extends string,
  T extends Schema.Struct.Fields,
>(props: CardDefinition<Id, T>): CardDefinition<Id, T> {
  return props;
}

// Source of truth - add all cards here
export const CardArray = [TextCard, ParameterCard] as const;

type Cards = (typeof CardArray)[number];
export type CardId = Cards["id"];
type GetCard<Id extends CardId> = Extract<Cards, { id: Id }>;

type CardSchemaMapType = {
  [K in CardId]: GetCard<K>["schema"];
};

type CardComponentMapType = {
  [K in CardId]: GetCard<K>["component"];
};

export const CardSchemaMap: CardSchemaMapType = {
  "text-card": TextCard.schema,
  "parameter-card": ParameterCard.schema,
};

export const CardComponentMap: CardComponentMapType = {
  "text-card": TextCard.component,
  "parameter-card": ParameterCard.component,
};

// Get schema type for a specific card
export type CardSchemaType<Id extends CardId> = Schema.Schema.Type<
  GetCard<Id>["schema"]
>;

// Get props type for a specific card's component
export type CardProps<Id extends CardId> = Parameters<
  GetCard<Id>["component"]
>[0];
