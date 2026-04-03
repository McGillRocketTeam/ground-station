# Local map tiles

Put local `.mbtiles` files in this directory.

The Tilt/docker-compose stack mounts `docker/assets/maps` into the `mbtileserver`
container at `/tilesets`, and serves each file at:

- `http://localhost:3001/services/<tileset_id>`
- `http://localhost:3001/services/<tileset_id>/tiles/{z}/{x}/{y}.jpg`

For the map card's raster overlay, these filenames are expected:

- `worldLowQuality.mbtiles`
- `satellite-2017-11-02_canada_ontario.mbtiles`
- `timminsCity.mbtiles`
- `launchcanada.mbtiles`
- `launchcanada2.mbtiles`

These files are intentionally gitignored because they are too large for the repo.

With `--enable-fs-watch` enabled in `docker-compose.yml`, adding or replacing a
flat `.mbtiles` file here is picked up without restarting the container.
