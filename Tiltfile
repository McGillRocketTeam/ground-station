local_resource(
    'frontend',
    serve_cmd="pnpm --filter @mrt/frontend dev",
		labels=['mrt'],
		links='http://localhost:5173',
		resource_deps=['backend']
)


local_resource(
    'backend',
    serve_cmd="cd apps/backend && mvn yamcs:run",
		labels=['mrt'],
		links='http://localhost:8090',
		deps=['./apps/backend/src/main/java'],
		readiness_probe=probe(
			period_secs=3,
			http_get=http_get_action(port=8090, path="/api")
		)
)

local_resource(
    'simulator',
    serve_cmd="pnpm --filter @mrt/simulator dev",
		serve_env={'YAMCS_INSTANCE': 'ground_station'},
		labels=['mrt'],
		links='http://localhost:5173',
		resource_deps=['backend']
)

docker_compose(
		"./docker/docker-compose.yml"
)

# dc_resource("backend", labels=['mrt'])
dc_resource("mbtileserver", labels=['infrastructure'])
dc_resource("mqtt_broker", labels=['infrastructure'])
