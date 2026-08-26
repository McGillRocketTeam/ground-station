FROM maven:3.9.11-eclipse-temurin-17 AS build

WORKDIR /build
COPY apps/backend/pom.xml ./
RUN mvn dependency:go-offline
COPY apps/backend/src ./src
RUN mvn package -DskipTests dependency:copy-dependencies -DincludeScope=runtime -DoutputDirectory=target/lib

FROM eclipse-temurin:17-jre
WORKDIR /yamcs
COPY --from=build /build/target/yamcs-mqtt-*.jar ./lib/yamcs-mqtt.jar
COPY --from=build /build/target/lib ./lib
COPY apps/backend/src/main/yamcs ./
EXPOSE 8090 10015/udp
CMD ["java", "-Djava.util.logging.manager=org.yamcs.logging.YamcsLogManager", "-Djava.library.path=lib:lib/ext", "-cp", "lib/*", "org.yamcs.YamcsServer"]
