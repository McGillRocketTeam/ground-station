FROM python:3.13-slim

RUN apt-get update \
    && apt-get install --no-install-recommends -y bluez libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY apps/ecoflow-mqtt/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY apps/ecoflow-mqtt/ecoflow_delta2_max_mqtt.py ./
COPY apps/ecoflow-mqtt/vendor ./vendor

ENTRYPOINT ["python", "ecoflow_delta2_max_mqtt.py"]
