export function MrtLogo() {
  return (
    <div
      className="flex items-center gap-3 uppercase text-white"
      style={{ fontFamily: "Eurostile, sans-serif" }}
      aria-label="McGill Rocket Team"
    >
      <div
        className="relative h-[2lh] shrink-0 overflow-hidden"
        style={{ width: "calc(2lh * 256 / 117)" }}
        aria-hidden="true"
      >
        <img
          className="absolute top-0 left-0 w-full"
          style={{ transform: "translateY(calc(-2lh * 69 / 117))" }}
          src="/icon.svg"
          alt=""
        />
      </div>
      {/*
      <div className="translate-y-[0.4lh] leading-[0.9] text-[24px]">
        McGill Rocket
        <br />
        Team
      </div>
      */}
    </div>
  );
}
