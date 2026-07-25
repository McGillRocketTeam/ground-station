import { Context, Effect, FiberSet, Layer, Schema } from "effect";
import { Atom } from "effect/unstable/reactivity";

export class AlarmSoundError extends Schema.TaggedErrorClass<AlarmSoundError>()("AlarmSoundError", {
  cause: Schema.Defect,
}) {}

interface AlarmSoundShape {
  readonly play: Effect.Effect<void, AlarmSoundError>;
  readonly stop: Effect.Effect<void>;
}

export class AlarmSound extends Context.Service<AlarmSound, AlarmSoundShape>()(
  "@mrt/frontend/AlarmSound",
) {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      let audioContext: AudioContext | undefined;
      let active: AudioBufferSourceNode | undefined;
      let shouldPlay = false;

      const makeAlarmBuffer = (context: AudioContext) => {
        const durationSeconds = 0.5;
        const frameCount = Math.floor(context.sampleRate * durationSeconds);
        const buffer = context.createBuffer(1, frameCount, context.sampleRate);
        const channel = buffer.getChannelData(0);

        for (let frame = 0; frame < frameCount; frame += 1) {
          const time = frame / context.sampleRate;
          const frequency = time < 0.25 ? 900 : 500;
          const edgeFade = Math.min(1, time / 0.01, (durationSeconds - time) / 0.01);
          channel[frame] = Math.sin(2 * Math.PI * frequency * time) * 0.2 * edgeFade;
        }

        return buffer;
      };

      const start = () => {
        const context = audioContext;
        if (!shouldPlay || active !== undefined || context?.state !== "running") return;

        const source = context.createBufferSource();
        source.buffer = makeAlarmBuffer(context);
        source.loop = true;
        source.connect(context.destination);
        source.onended = () => {
          source.disconnect();
          if (active === source) active = undefined;
        };
        active = source;
        source.start();
      };

      const stop = Effect.fn("AlarmSound.stop")(() =>
        Effect.sync(() => {
          shouldPlay = false;
          if (active === undefined) return;

          active.onended = null;
          active.stop();
          active.disconnect();
          active = undefined;
        }),
      );

      const play = Effect.fn("AlarmSound.play")(() =>
        Effect.try({
          try: () => {
            shouldPlay = true;
            start();
          },
          catch: (cause) => new AlarmSoundError({ cause }),
        }),
      );

      const fibers = yield* FiberSet.make<void, never>();
      const run = yield* FiberSet.runtime(fibers)();

      const unlock = () => {
        run(
          Effect.tryPromise({
            try: async () => {
              const context = audioContext ?? new AudioContext();
              audioContext = context;
              await context.resume();
              start();
            },
            catch: (cause) => new AlarmSoundError({ cause }),
          }).pipe(
            Effect.tapCause((cause) =>
              Effect.logError("[alarm-sound] failed to unlock audio", cause),
            ),
            Effect.ignore,
          ),
        );
      };

      yield* Effect.acquireRelease(
        Effect.sync(() => {
          window.addEventListener("pointerdown", unlock, { capture: true });
          window.addEventListener("keydown", unlock, { capture: true });
        }),
        () =>
          Effect.gen(function* () {
            window.removeEventListener("pointerdown", unlock, { capture: true });
            window.removeEventListener("keydown", unlock, { capture: true });
            yield* stop();

            const context = audioContext;
            if (context !== undefined) {
              yield* Effect.tryPromise(() => context.close()).pipe(Effect.ignore);
            }
          }),
      );

      return AlarmSound.of({ play: play(), stop: stop() });
    }),
  );
}

const alarmSoundRuntime = Atom.runtime(AlarmSound.layer);

export const playAlarmSoundAtom = alarmSoundRuntime.fn(
  Effect.fn("playAlarmSoundAtom")(function* () {
    const alarmSound = yield* AlarmSound;
    yield* alarmSound.play;
  }),
);

export const stopAlarmSoundAtom = alarmSoundRuntime.fn(
  Effect.fn("stopAlarmSoundAtom")(function* () {
    const alarmSound = yield* AlarmSound;
    yield* alarmSound.stop;
  }),
);
