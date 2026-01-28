local_resource(
    'frontend',
    serve_cmd="pnpm --filter @mrt/frontend dev",
		labels=['mrt'],
		links='http://localhost:5173'
)


local_resource(
    'backend',
    serve_cmd="cd apps/backend && mvn yamcs:run",
		labels=['mrt'],
		links='http://localhost:8090'
)

local_resource(
    'simulator',
    serve_cmd="pnpm --filter @mrt/simulator dev",
		serve_env=['YAMCS_INSTANCE': 'ground_station'],
		labels=['mrt'],
		links='http://localhost:5173'
)

docker_compose(
		"./docker/docker-compose.yml"
)

# dc_resource("backend", labels=['mrt'])
dc_resource("mbtileserver", labels=['infrastructure'])
dc_resource("mqtt_broker", labels=['infrastructure'])
