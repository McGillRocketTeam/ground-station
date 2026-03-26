from yamcs.client import YamcsClient

client = YamcsClient('localhost:8090')
archive = client.get_archive(instance='ground_station')
mdb = client.get_mdb(instance='ground_station')

# 1. List of your parameter names
names = [
    '/LabJackT7/calibrated_ccpt_pressure_psi',
    '/LabJackT7/calibrated_fill_pressure_psi',
    '/LabJackT7/calibrated_purge_pressure_psi',
    '/LabJackT7/calibrated_run_pressure_psi',
    '/LabJackT7/calibrated_tank_mass',
    '/LabJackT7/calibrated_tank_pressure_psi',
    '/LabJackT7/calibrated_thrust_newtons',
    '/Thermocouple/tc2_temp',
    '/Thermocouple/tc5_temp'
]

# 2. Convert names to Parameter objects from the MDB
my_params = [mdb.get_parameter(name) for name in names]

start_time = '2026-03-14T23:00:00.099Z'
stop_time = '2026-03-15T05:52:20.876Z'

# 3. Use the objects in the export function
with open('ground_station_data.csv', 'wb') as f:
    archive.export_parameter_values(
        parameters=my_params,
        start=start_time,
        stop=stop_time,
        interval=1000, # Use 1000 for 1 second (ms)
        stream=f
    )
