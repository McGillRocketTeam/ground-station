import type { IDockviewPanelProps } from "dockview-react";
import type { ErrorInfo, ReactNode } from "react";

import { Schema } from "effect";
import { Component, createElement } from "react";

import { CommandButtonCard } from "@/cards/command-button";
import { CommandHistoryCard } from "@/cards/command-history";
import { EventsCard } from "@/cards/events";
import { LinksCard } from "@/cards/links";
import { ParameterChartCard } from "@/cards/parameter-chart";
import { ParameterTable } from "@/cards/parameter-table";
import { TextCard } from "@/cards/text-card";

export interface CardDefinition<
  Id extends string,
  T extends Schema.Struct.Fields,
> {
  id: Id;
  name: string;
  schema: Schema.Struct<T>;
  component: (
    props: IDockviewPanelProps<Schema.Schema.Type<Schema.Struct<T>>>,
  ) => ReactNode;
}

class CardErrorBoundary extends Component<
  {
    cardName: string;
    children?: ReactNode;
  },
  {
    error: Error | null;
  }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[dashboard] Card crashed: ${this.props.cardName}`, {
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.error) {
      return createElement(
        "div",
        {
          className:
            "text-error grid h-full place-items-center p-4 font-mono text-xs uppercase",
        },
        `${this.props.cardName} failed to render: ${this.state.error.message}`,
      );
    }

    return this.props.children;
  }
}

export function makeCard<
  const Id extends string,
  T extends Schema.Struct.Fields,
>(props: CardDefinition<Id, T>): CardDefinition<Id, T> {
  return {
    ...props,
    component: (cardProps) =>
      createElement(
        CardErrorBoundary,
        { cardName: props.name },
        props.component(cardProps),
      ),
  };
}

// Source of truth - add all cards here
export const CardArray: CardDefinition<string, any>[] = [
  TextCard,
  ParameterTable,
  CommandHistoryCard,
  ParameterChartCard,
  LinksCard,
  EventsCard,
  CommandButtonCard,
] as const;

type Cards = (typeof CardArray)[number];
export type CardId = Cards["id"];
type GetCard<Id extends CardId> = Extract<Cards, { id: Id }>;

export const CardSchemaMap = Object.fromEntries(
  CardArray.map((c) => [c.id, c.schema]),
) as {
  [K in CardId]: GetCard<K>["schema"];
};

export const CardComponentMap = Object.fromEntries(
  CardArray.map((c) => [c.id, c.component]),
) as {
  [K in CardId]: GetCard<K>["component"];
};

// Get schema type for a specific card
export type CardSchemaType<Id extends CardId> = Schema.Schema.Type<
  GetCard<Id>["schema"]
>;

// Get props type for a specific card's component
export type CardProps<Id extends CardId> = Parameters<
  GetCard<Id>["component"]
>[0];
