# Local map tiles

Put local `.mbtiles` files in this directory.

The Tilt/docker-compose stack mounts `docker/assets/maps` into the `mbtileserver`
container at `/tilesets`, and serves each file at:

- `http://localhost:3001/services/<tileset_id>`
- `http://localhost:3001/services/<tileset_id>/tiles/{z}/{x}/{y}.jpg`

All frontend maps use the same offline style. These filenames are required:

- `region-satellite-z0-z16.mbtiles`
- `detail-5km-z17-z18.mbtiles`
- `detail-1km-z19-z21.mbtiles`
- `lc2025.mbtiles`

These files are intentionally gitignored because they are too large for the repo.

With `--enable-fs-watch` enabled in `docker-compose.yml`, adding or replacing a
flat `.mbtiles` file here is picked up without restarting the container.
