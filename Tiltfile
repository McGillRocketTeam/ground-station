local_resource(
    'frontend',
    serve_cmd="pnpm --filter @mrt/frontend dev",
		labels=['mrt'],
		links='http://localhost:5173'
)

local_resource(
    'simulator',
    serve_cmd="YAMCS_INSTANCE=mqtt-frames pnpm --filter @mrt/simulator dev",
		labels=['mrt'],
		links='http://localhost:5173'
)

docker_compose(
		"./docker/docker-compose.yml"
)

dc_resource("backend", labels=['mrt'])
dc_resource("mbtileserver", labels=['infrastructure'])
dc_resource("mqtt_broker", labels=['infrastructure'])

# load('ext://uibutton', 'cmd_button', 'text_input', 'location')
# cmd_button('hello',
# 		argv=['sh', '-c', 'echo Hello, $NAME'],
# 		resource='simulator',
#   	location=location.RESOURCE,
#   	icon_name='front_hand',
#	    text='Delay (ms)',
# 		inputs=[
# 		text_input('Delay (ms)'),
# 	],
# )
