---
name: hkx-docker-patterns
description: "Docker and Docker Compose operations for Pi projects: Dockerfile review, build context, non-root images, networking, volumes, health checks, and compose workflows."
origin: HKX-converted-for-Pi
---

# HKX Docker Patterns For Pi

Use when creating, reviewing, or debugging Dockerfiles, Compose files, container
networking, image builds, or local multi-service workflows.

## Dockerfile Review

Check:

- pinned base image, no `latest`
- small build context and useful `.dockerignore`
- dependency files copied before source for cache reuse
- multi-stage build where it reduces runtime image size
- non-root runtime user
- no secrets baked into image layers
- health check when the image runs a service
- platform/arch expectations documented when native binaries are involved

## Compose Review

Check:

- services have clear names and dependency boundaries
- only needed ports are exposed
- internal service names are used for inter-container URLs
- volumes do not hide tracked source unexpectedly
- persistent data uses named volumes
- health checks gate dependent services when startup order matters
- dev overrides are separated from production settings

## Debugging

Use evidence before changing files:

```bash
docker compose config
docker compose ps
docker compose logs <service>
docker image ls
```

For build issues:

- inspect build context
- inspect copied files and ignored files
- compare target stage vs runtime command
- verify native binary/platform assumptions

## Security

- Do not put credentials in `Dockerfile`, image labels, or Compose files.
- Use environment variable names or secret mounts, not values.
- Avoid mounting host-sensitive paths unless required.
- Avoid privileged containers by default.

## Output

```text
Docker surface:
Build/runtime risks:
Networking/volume risks:
Security risks:
Fixes:
Verification:
```
