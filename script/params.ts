const params = await fetch(
  "http://localhost:8090/api/mdb/launch-canada/parameters?system=/SystemA/Rocket/FlightComputer&details=true&pos=0&limit=100",
  {
    headers: {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      "sec-ch-ua": '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      cookie:
        "auth_session=nja6fjwgkiv3wdvr2o24gcz2wb7r5uie2vuc5c6e; ph_phc_8ID4pGYRuct8V2KdtnYtCLPGRjaO3bEs7TVQiDGfXmu_posthog=%7B%22distinct_id%22%3A%22019bfd31-5c90-7920-8f6c-05b7d5fb42dc%22%2C%22%24sesid%22%3A%5B1769561359500%2C%22019c0213-848c-7117-8d83-1f405e42cb3c%22%2C1769561359500%5D%2C%22%24epp%22%3Atrue%2C%22%24initial_person_info%22%3A%7B%22r%22%3A%22%24direct%22%2C%22u%22%3A%22http%3A%2F%2Flocalhost%3A3000%2F%22%7D%7D; ph_phc_VTSzjyHaccTuqkvj3KAFQTQ0GXS2YrVHQGmwWv5mVOJ_posthog=%7B%22%24device_id%22%3A%22019cb0dd-6b66-7158-9591-9b847b04a1ea%22%2C%22distinct_id%22%3A%22019cb0dd-6b66-7158-9591-9b847b04a1ea%22%2C%22%24sesid%22%3A%5B1775701378207%2C%22019d7008-82ad-7f3b-b8cf-fd8d44ce1963%22%2C1775701099174%5D%2C%22%24initial_person_info%22%3A%7B%22r%22%3A%22%24direct%22%2C%22u%22%3A%22http%3A%2F%2Flocalhost%3A4321%2F%22%7D%2C%22%24user_state%22%3A%22anonymous%22%7D; Tilt-Token=519497f3-86ab-4abb-a3d5-bd4b9bbb86e7",
      Referer:
        "http://localhost:8090/telemetry/parameters?c=launch-canada__realtime&system=%2FSystemA%2FRocket%2FFlightComputer",
    },
    body: null,
    method: "GET",
  },
);

const json = await params.json();

console.log(
  "Parameters:",
  json.parameters.map((a) => a.qualifiedName),
);

const cmds = await fetch(
  "http://localhost:8090/api/mdb/launch-canada/commands?system=/FlightComputer&noAbstract=true&details=true&pos=0&limit=100&fields=name,qualifiedName,alias,effectiveSignificance,shortDescription",
  {
    headers: {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      "sec-ch-ua": '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      cookie:
        "auth_session=nja6fjwgkiv3wdvr2o24gcz2wb7r5uie2vuc5c6e; ph_phc_8ID4pGYRuct8V2KdtnYtCLPGRjaO3bEs7TVQiDGfXmu_posthog=%7B%22distinct_id%22%3A%22019bfd31-5c90-7920-8f6c-05b7d5fb42dc%22%2C%22%24sesid%22%3A%5B1769561359500%2C%22019c0213-848c-7117-8d83-1f405e42cb3c%22%2C1769561359500%5D%2C%22%24epp%22%3Atrue%2C%22%24initial_person_info%22%3A%7B%22r%22%3A%22%24direct%22%2C%22u%22%3A%22http%3A%2F%2Flocalhost%3A3000%2F%22%7D%7D; ph_phc_VTSzjyHaccTuqkvj3KAFQTQ0GXS2YrVHQGmwWv5mVOJ_posthog=%7B%22%24device_id%22%3A%22019cb0dd-6b66-7158-9591-9b847b04a1ea%22%2C%22distinct_id%22%3A%22019cb0dd-6b66-7158-9591-9b847b04a1ea%22%2C%22%24sesid%22%3A%5B1775701378207%2C%22019d7008-82ad-7f3b-b8cf-fd8d44ce1963%22%2C1775701099174%5D%2C%22%24initial_person_info%22%3A%7B%22r%22%3A%22%24direct%22%2C%22u%22%3A%22http%3A%2F%2Flocalhost%3A4321%2F%22%7D%2C%22%24user_state%22%3A%22anonymous%22%7D; Tilt-Token=519497f3-86ab-4abb-a3d5-bd4b9bbb86e7",
      Referer:
        "http://localhost:8090/commanding/send?c=launch-canada__realtime&system=%2FFlightComputer",
    },
    body: null,
    method: "GET",
  },
);

const cmdjson = await cmds.json();

console.log(
  "Commands:",
  cmdjson.commands.map((a) => a.qualifiedName),
);
