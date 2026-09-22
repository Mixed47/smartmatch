# ---------- Stage 1: build the Go binary ----------
FROM golang:1.26-alpine AS builder

WORKDIR /src

# Dependencies are cached separately from the source code.
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/smartmatch-api .

# ---------- Stage 2: minimal runtime ----------
FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata \
    && adduser -D -u 10001 appuser

WORKDIR /app
COPY --from=builder /out/smartmatch-api /app/smartmatch-api

RUN mkdir -p /app/uploads && chown -R appuser:appuser /app
USER appuser

ENV PORT=8080
EXPOSE 8080

CMD ["/app/smartmatch-api"]
