import { OverlayCard } from "../components/overlay-card.tsx";

export function MissionUpdateCard({ message }: { message: string }) {
  return (
    <OverlayCard title="Mission Update">
      <p className="max-w-[40ch] text-pretty whitespace-pre-wrap text-lg leading-relaxed uppercase">
        {message}
      </p>
    </OverlayCard>
  );
}
