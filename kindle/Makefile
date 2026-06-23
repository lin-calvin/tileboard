# tileboard_kindle Makefile
#   make              → cross-compile for Kindle (ARMv7, stripped)
#   make host         → build for host (testing)
#   make run          → build and run locally (won't find eips, but tests fetch/convert)
#   make clean        → remove binaries

BINARY  := tileboard_kindle
MAIN    := .
LDFLAGS := -s -w

# ---- config overrides (passed at link time) ----
#   make FETCH_URL=http://... OUTPUT_PATH=/tmp/foo.png INTERVAL=3s ROTATE=90
FETCH_URL   ?= http://192.168.15.21:3456/png
OUTPUT_PATH ?= /tmp/tileboard.png
INTERVAL    ?= 1s
ROTATE      ?= 90

GO_LDFLAGS  = $(LDFLAGS) \
	-X main.fetchURL=$(FETCH_URL) \
	-X main.outputPath=$(OUTPUT_PATH) \
	-X main.interval=$(INTERVAL) \
	-X main.rotateDeg=$(ROTATE)

# ---- default: Kindle cross-compile (ARMv7, hard-float) ----
.PHONY: all
all:
	GOOS=linux GOARCH=arm GOARM=7 go build \
		-ldflags="$(GO_LDFLAGS)" \
		-o $(BINARY) $(MAIN)
	@file $(BINARY)


# ---- run locally (for testing fetch/convert; eips will fail) ----
.PHONY: run
run: host
	./$(BINARY)

# ---- clean ----
.PHONY: clean
clean:
	rm -f $(BINARY)
