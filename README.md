# Docker log streamer


Originally developed for CC16

# Executing:

```
docker run --rm --restart=always -d -v /var/run/docker.sock:/var/run/docker.sock -p 1337:8080 theikkila/docker-log-streamer
```

After that you have websocket-server listening at 1337
