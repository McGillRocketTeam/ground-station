config.define_bool('simulator')
config.define_string('environment')
config.define_string('simulator_data_mode')
config.define_string('mqtt_broker_url')
config.define_bool('ecoflow_mqtt')
config.define_string('ecoflow_user_id')
config.define_string('ecoflow_ble_address')
config.define_string('ecoflow_mqtt_host')
config.define_string('ecoflow_mqtt_port')
cfg = config.parse()
simulator_enabled = cfg.get('simulator', False)
mrt_environment = cfg.get('environment', 'production')
simulator_data_mode = cfg.get('simulator_data_mode', 'incremental')
mqtt_broker_url = cfg.get('mqtt_broker_url', '')
ecoflow_mqtt_enabled = cfg.get('ecoflow_mqtt', False)
ecoflow_user_id = cfg.get('ecoflow_user_id', '')
ecoflow_ble_address = cfg.get('ecoflow_ble_address', '')
ecoflow_mqtt_host = cfg.get('ecoflow_mqtt_host', 'localhost')
ecoflow_mqtt_port = cfg.get('ecoflow_mqtt_port', '1883')
use_external_mqtt_broker = mqtt_broker_url != ''
backend_resource_deps = [] if use_external_mqtt_broker else ['mqtt_broker']
backend_env = {'MQTT_BROKER_URL': mqtt_broker_url} if use_external_mqtt_broker else {}
frontend_mqtt_broker_url = mqtt_broker_url if use_external_mqtt_broker else 'ws://localhost:9001'
ecoflow_resource_deps = [] if use_external_mqtt_broker else ['mqtt_broker']
simulator_env = {
	'YAMCS_INSTANCE': 'launch-canada',
	'DATA_MODE': simulator_data_mode,
}

if use_external_mqtt_broker:
	simulator_env.update({'BROKER_URL': mqtt_broker_url})

if mrt_environment != 'development' and mrt_environment != 'production':
	fail("Tilt config 'environment' must be either 'development' or 'production'")

if simulator_data_mode != 'random' and simulator_data_mode != 'incremental':
	fail("Tilt config 'simulator_data_mode' must be either 'random' or 'incremental'")

if ecoflow_mqtt_enabled and ecoflow_user_id == '':
	fail("Tilt config 'ecoflow_user_id' is required when 'ecoflow_mqtt' is true")

open_frontend_cmd = os.name == 'nt' and "python -m webbrowser http://localhost:5173" or "python3 -m webbrowser http://localhost:5173"

local_resource(
    'frontend',
    serve_cmd="pnpm --filter @mrt/frontend dev",
		serve_env={
			'YAMCS_URL': 'http://localhost:8090',
			'MRT_ENVIRONMENT': mrt_environment,
			'MQTT_BROKER_URL': frontend_mqtt_broker_url,
		},
		labels=['mrt'],
		links='http://localhost:5173',
		resource_deps=['backend', 'yamcs-effect'],
		readiness_probe=probe(
			period_secs=3,
			http_get=http_get_action(port=5173, path="/")
		)
)

local_resource(
		'open-frontend',
		cmd=open_frontend_cmd,
		labels=['mrt'],
		resource_deps=['frontend']
)

local_resource(
    'backend',
    serve_cmd="cd apps/backend && mvn yamcs:run",
		serve_env=backend_env,
		labels=['mrt'],
		links='http://localhost:8090',
		deps=['./apps/backend/src/main/java'],
		resource_deps=backend_resource_deps,
		readiness_probe=probe(
			period_secs=3,
			http_get=http_get_action(port=8090, path="/api")
		)
)

if simulator_enabled:
	local_resource(
			'simulator',
			serve_cmd="pnpm --filter @mrt/simulator dev",
			serve_env=simulator_env,
			labels=['mrt'],
			links='http://localhost:5173',
			resource_deps=['backend', 'yamcs-effect']
	)

if ecoflow_mqtt_enabled:
	ecoflow_address_arg = ecoflow_ble_address != '' and ' --address ' + ecoflow_ble_address or ''
	ecoflow_cmd = os.name == 'nt' and '''
cd .\\apps\\ecoflow-mqtt

if (!(Test-Path venv)) {
    python -m venv venv
}

.\\venv\\Scripts\\python -m pip install -r requirements.txt
.\\venv\\Scripts\\python ecoflow_delta2_max_mqtt.py --user-id {user_id} --mqtt-host {mqtt_host} --mqtt-port {mqtt_port}{address_arg}
'''.format(
		user_id=ecoflow_user_id,
		mqtt_host=ecoflow_mqtt_host,
		mqtt_port=ecoflow_mqtt_port,
		address_arg=ecoflow_address_arg,
	) or '''
set -e

cd ./apps/ecoflow-mqtt

if [ ! -d venv ]; then
    python3 -m venv venv
fi

./venv/bin/python -m pip install -r requirements.txt
./venv/bin/python ecoflow_delta2_max_mqtt.py --user-id {user_id} --mqtt-host {mqtt_host} --mqtt-port {mqtt_port}{address_arg}
'''.format(
		user_id=ecoflow_user_id,
		mqtt_host=ecoflow_mqtt_host,
		mqtt_port=ecoflow_mqtt_port,
		address_arg=ecoflow_address_arg,
	)
	local_resource(
		'ecoflow-mqtt',
		serve_cmd=ecoflow_cmd,
		labels=['infrastructure'],
		resource_deps=ecoflow_resource_deps,
		deps=[
			'./apps/ecoflow-mqtt/ecoflow_delta2_max_mqtt.py',
			'./apps/ecoflow-mqtt/requirements.txt',
			'./apps/ecoflow-mqtt/vendor/ecoflow_ble',
		]
	)

local_resource(
    'xtce-generator',
		labels=['infrastructure'],
    cmd=os.name == 'nt' and '''
    cd ./apps/xtce-generator

    if (!(Test-Path venv)) {
        python -m venv venv
    }

    .\\venv\\Scripts\\pip install -r requirements.txt
    .\\venv\\Scripts\\python ./src/xtce_generator.py --output-telemetry-xml "../../backend/src/main/yamcs/mdb/rocket.xml" --output-commanding-xml "../../backend/src/main/yamcs/mdb/commands.xml"
    ''' or '''
    set -e

    cd ./apps/xtce-generator

    if [ ! -d venv ]; then
        python3 -m venv venv
    fi

    ./venv/bin/pip install -r requirements.txt
    ./venv/bin/python ./src/xtce_generator.py --output-telemetry-xml "../backend/src/main/yamcs/mdb/rocket.xml" --output-commanding-xml "../backend/src/main/yamcs/mdb/commands.xml"
    ''',
    deps=[
        "requirements.txt",
        "xtce_generator.py",
    ]
)

local_resource(
    'yamcs-effect',
    serve_cmd="pnpm turbo dev --filter @mrt/yamcs-effect",
		labels=['packages'],
		resource_deps=[]
)

docker_compose(
		"./docker/docker-compose.yml"
)

# dc_resource("backend", labels=['mrt'])
dc_resource("mbtileserver", labels=['infrastructure'])

if not use_external_mqtt_broker:
	dc_resource("mqtt_broker", labels=['infrastructure'])
