# Use Maven + JDK image
FROM maven:3.9.3-eclipse-temurin-17

# Set working directory
WORKDIR /org.yamcs.mqtt

# Copy pom.xml first (for dependency caching)
COPY pom.xml .

# Pre-download dependencies for faster builds
RUN mvn dependency:go-offline

# Copy the rest of the source code
COPY src ./src

# Expose any ports your app uses (adjust as needed)
EXPOSE 8090

# Default command to run your app with Maven Yamcs plugin
CMD ["mvn", "yamcs:run"]
