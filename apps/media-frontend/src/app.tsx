import {
  DataGridBody,
  DataGridHead,
  DataGridHeader,
  DataGridRow,
} from "./components/ui/data-grid.tsx";

export function App() {
  return (
    <div className="w-screen h-screen relative">
      <div className="absolute top-4 left-4 grid min-w-72 grid-cols-[minmax(10rem,1fr)_auto] gap-px border font-mono">
        <DataGridHeader>
          <DataGridHead className="col-span-full flex justify-between gap-8">
            <span>Flight telemetry</span>
            <span className="text-mrt">Live</span>
          </DataGridHead>
        </DataGridHeader>
        <DataGridBody>
          <DataGridRow>
            <div>Current phase</div>
            <div className="text-right">Powered ascent</div>
          </DataGridRow>
          <DataGridRow>
            <div>Altitude</div>
            <div className="text-right">3,842 m</div>
          </DataGridRow>
          <DataGridRow>
            <div>Speed</div>
            <div className="text-right">612 km/h</div>
          </DataGridRow>
          <DataGridRow>
            <div>Distance travelled</div>
            <div className="text-right">8.4 km</div>
          </DataGridRow>
          <DataGridRow>
            <div>Time to apogee</div>
            <div className="text-right">00:18</div>
          </DataGridRow>
        </DataGridBody>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 h-28 w-56 origin-bottom-left scale-[0.85] overflow-hidden select-none">
        <img
          src="/icon.svg"
          alt="McGill Rocket Team"
          className="absolute top-1/2 left-0 w-full -translate-y-1/2"
        />
      </div>
    </div>
  );
}
