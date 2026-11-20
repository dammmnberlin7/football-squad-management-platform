# Build tested artifacts first: scripts/install-cloud, or Maven package + npm ci/build.
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
COPY --chown=10001:10001 backend/target/squad-0.1.0.jar /app/app.jar
COPY --chown=10001:10001 frontend/dist/ /app/static/
COPY --chown=10001:10001 --chmod=0444 deployment/healthcheck.sh /app/healthcheck.sh
ENV SPRING_WEB_RESOURCES_STATIC_LOCATIONS=file:/app/static/
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD ["bash", "/app/healthcheck.sh"]
ENTRYPOINT ["java","-XX:MaxRAMPercentage=75.0","-jar","/app/app.jar"]
