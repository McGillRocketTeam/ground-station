FROM maven:3.9.3-eclipse-temurin-17

WORKDIR /org.yamcs.mqtt

# Copy backend pom.xml
COPY apps/backend/pom.xml .

RUN mvn dependency:go-offline

# Copy backend source
COPY apps/backend/src ./src

EXPOSE 8090

CMD ["mvn", "yamcs:run"]
