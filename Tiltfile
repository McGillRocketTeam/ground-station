config.define_bool('simulator')
cfg = config.parse()
simulator_enabled = cfg.get('simulator', True)

local_resource(
    'frontend',
    serve_cmd="YAMCS_URL=http://localhost:8090 pnpm --filter @mrt/frontend dev",
		serve_env={
			'YAMCS_INSTANCE': 'ground_station',
			'YAMCS_URL': 'http://localhost:8090',
		},
		labels=['mrt'],
		links='http://localhost:5173',
		resource_deps=['backend', 'yamcs-effect', 'yamcs-atom']
)


local_resource(
    'backend',
    serve_cmd="cd apps/backend && mvn yamcs:run",
		labels=['mrt'],
		links='http://localhost:8090',
		deps=['./apps/backend/src/main/java'],
		resource_deps=[],
		readiness_probe=probe(
			period_secs=3,
			http_get=http_get_action(port=8090, path="/api")
		)
)

if simulator_enabled:
	local_resource(
			'simulator',
			serve_cmd="pnpm --filter @mrt/simulator dev",
			serve_env={'YAMCS_INSTANCE': 'ground_station'},
			labels=['mrt'],
			links='http://localhost:5173',
			resource_deps=['backend', 'yamcs-effect']
	)

local_resource(
    'xtce-generator',
		labels=['infrastructure'],
    cmd="""
    set -e

    cd ./apps/xtce-generator

    if [ ! -d venv ]; then
        python3 -m venv venv
    fi

    ./venv/bin/pip install -r requirements.txt
    ./venv/bin/python converter.py --output "../backend/src/main/yamcs/mdb/rocket.xml"
    """,
    deps=[
        "requirements.txt",
        "converter.py",
    ]
)


local_resource(
    'xtce-generator',
    cmd="""
    set -e

    cd ./apps/xtce-generator

    if [ ! -d venv ]; then
        python3 -m venv venv
    fi

    ./venv/bin/pip install -r requirements.txt
    ./venv/bin/python converter.py --output "../backend/src/main/yamcs/mdb/rocket.xml"
    """,
    deps=[
        "requirements.txt",
        "converter.py",
    ]
)


local_resource(
    'yamcs-effect',
    serve_cmd="pnpm turbo dev --filter @mrt/yamcs-effect",
		labels=['packages'],
		resource_deps=['backend']
)

local_resource(
    'yamcs-atom',
    serve_cmd="pnpm turbo dev --filter @mrt/yamcs-atom",
		labels=['packages'],
		resource_deps=['backend', 'yamcs-effect']
)

docker_compose(
		"./docker/docker-compose.yml"
)

# dc_resource("backend", labels=['mrt'])
dc_resource("mbtileserver", labels=['infrastructure'])
dc_resource("mqtt_broker", labels=['infrastructure'])
