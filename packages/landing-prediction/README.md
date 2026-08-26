# Landing Prediction

This package provides a bare-bones estimate of where a rocket might land using
only the limited telemetry received during flight. It is intended to give
operators useful guidance within seconds of a flight ending, especially when
the final GPS position is unavailable.

The prediction is not a precise recovery coordinate. It extrapolates from
signals such as the last valid GPS positions, altitude, vertical speed, flight
stage, and parachute deployment evidence. Missing telemetry, stale GPS fixes,
wind changes, terrain, and uncertain parachute behavior can all move the actual
landing position away from the estimate.

Every predicted location must therefore be presented with an uncertainty area.
Operators should interpret the result as a region in which the rocket might be,
not as confirmation that the rocket is at the center point. The estimate is a
search aid and should not replace direct GPS, visual confirmation, or normal
recovery procedures.

The prediction logic is shared by Yamcs algorithms and offline flight replay
tests. Replaying recorded flights at earlier telemetry cutoffs lets us compare
predictions against known landing positions and gradually calibrate the
reported uncertainty.

## First-pass model

`landing_prediction/predictor.py` contains the dependency-free prediction
logic. The model intentionally remains simple:

1. Fit eastward and northward ground velocity to the most recent valid GPS
   fixes.
2. Fit vertical velocity to recent altitude-above-ground measurements.
3. Estimate remaining descent time from altitude, descent rate, and whether a
   future main deployment is still expected.
4. Project the recent horizontal velocity over the estimated remaining time.
5. Build a conservative search radius from GPS fit error, altitude fit error,
   deployment uncertainty, and an allowance for future track changes.

The flight stage and deployment command are treated as evidence, not proof that
a parachute opened. If the main was commanded but the measured descent rate did
not slow down, the model continues using the observed fast descent.

The public API returns values shaped like the intended Yamcs outputs:

```python
{
    "predicted_location": {
        "latitude": 42.0,
        "longitude": -77.0,
    },
    "predicted_location_accuracy": 300.0,
}
```

`predicted_location_accuracy` is currently an uncalibrated search radius in
metres. It should not be labelled as a formal confidence interval until replay
results from enough flights support that claim.

## Running it

Run the offline unit and URRG replay tests from the workspace root:

```sh
pnpm --filter @mrt/landing-prediction test
```

Regenerate the flight-computer XTCE after changing the predictor or its Yamcs
adapter:

```sh
cd apps/xtce-generator
python src/xtce_generator.py \
  --output-telemetry-xml ../backend/src/main/yamcs/mdb/rocket.xml \
  --output-commanding-xml ../backend/src/main/yamcs/mdb/commands.xml
```

Start the backend from `apps/backend` with:

```sh
mvn yamcs:run
```

## Yamcs integration

The XTCE generator reads `config.py`, `predictor.py`, and
`yamcs/algorithm.py`, combines them into one self-contained Python algorithm
body, and embeds it in `rocket.xml`. The generated body is therefore
copy-pasteable into the Yamcs algorithm editor and does not depend on a Python
module search path at runtime.

The backend includes Jython 2.7.4, which Yamcs requires for Python algorithms.
Because the same rocket MDB is mounted beneath both redundant systems, Yamcs
provides these derived parameters for each flight computer:

- `/SystemA/Rocket/FlightComputer/predicted_location_latitude`
- `/SystemA/Rocket/FlightComputer/predicted_location_longitude`
- `/SystemA/Rocket/FlightComputer/predicted_location_accuracy`
- `/SystemB/Rocket/FlightComputer/predicted_location_latitude`
- `/SystemB/Rocket/FlightComputer/predicted_location_longitude`
- `/SystemB/Rocket/FlightComputer/predicted_location_accuracy`

Latitude and longitude are degrees. Accuracy is the conservative,
uncalibrated search radius in metres. The algorithm emits no value until it has
enough recent GPS and descending altitude samples to form a prediction.

Inputs passed to `LandingPredictor.update` must be normalized to seconds,
metres, and metres per second. The URRG export records barometric altitude in
feet, so its replay test converts that parameter to metres before prediction.

## Configuration

All recovery assumptions, fitting windows, uncertainty allowances, and optional
vehicle simulation values live in `LandingPredictionConfig`. This keeps values
that will change after future simulations out of the prediction math:

```python
from landing_prediction import LandingPredictionConfig, LandingPredictor

config = LandingPredictionConfig(
    main_deployment_agl_m=500.0,
    nominal_main_descent_mps=7.5,
    gps_window_s=15.0,
)
predictor = LandingPredictor(config)
```

Unknown parameter names raise an error instead of silently retaining an old
assumption.

The values in `luminor_simulation_config()` come from the supplied Project
Luminor simulation tables. They describe a 50.4 kg dry-mass, 4.04 m long vehicle
with a predicted 4,152 m apogee and dual-separation, dual-deployment recovery.
They do **not** describe the rocket flown in the URRG fixture. URRG tests use the
generic model configuration and URRG telemetry only.

The supplied Luminor tables do not include main deployment altitude or nominal
parachute descent rates. Those values remain generic assumptions and should be
overridden when recovery simulation results are available. Vehicle mass,
geometry, thrust, and ascent values are retained as context for future physical
models but are not used by the current constant-drift predictor.

## Runtime compatibility

Yamcs loads Python algorithms through the optional Jython 2.7.4 dependency.
Code imported by the Yamcs algorithm must therefore remain compatible with
Python 2.7 and must not depend on CPython extension modules.

## URRG fixture

`tests/fixtures/urrg.csv` contains every telemetry parameter from
`docs/telemetry.csv` between the inclusive bounds taken from the existing flight
window:

- Start: `2026-03-28T18:16:00.057Z`
- End: `2026-03-28T18:18:54.373Z`

Regenerate it from the workspace root with:

```sh
pnpm --filter @mrt/landing-prediction extract:urrg
```
