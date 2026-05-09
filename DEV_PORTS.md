# Development Ports

Local website projects use the `3200-3499` range so they can run side by side without collisions. Software, tooling, and non-website development projects should use `5100-5999`.

Database services may keep standard local ports, such as MySQL on `3306` and Postgres on `5432`; do not assign application dev servers to those service ports.

## Assigned Ports

| Surface | Port |
| --- | ---: |
| Bow Wow public frontend | `3206` |
| Bow Wow backend API | `3316` |
| Bow Wow admin frontend | `3406` |

The local dev scripts already use these assigned ports by default. Override with environment variables only for temporary local debugging.
