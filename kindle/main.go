package main

import (
	"bytes"
	"flag"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"syscall"
	"time"
)

// ---- config (overridable via -ldflags "-X main.Var=value") ----

var (
	fetchURL   = "https://tile.openstreetmap.org/14/8711/5685.png" // URL of color PNG to fetch
	outputPath = "/tmp/tileboard.png"                               // where to write the grayscale PNG
	interval   = "1s"                                               // fetch interval, e.g. "1s", "500ms", "5s"
	rotateDeg  = "0"                                                // rotation: 0, 90, 180, 270 (string for ldflags)
)

const userAgent = "tileboard_kindle/1.0"

// ---- CLI flags ----

var (
	oneshot  = flag.Bool("oneshot", false, "fetch once, display, and exit")
	restore  = flag.Bool("restore", false, "restore Kindle UI and exit (does not fetch)")
	rotateDefault = parseRotateDeg(rotateDeg)
	rotateFl = flag.Int("rotate", rotateDefault, "rotate image clockwise before display: 0, 90, 180, or 270")
)

// ---- main ----

func parseRotateDeg(s string) int {
	switch s {
	case "90":
		return 90
	case "180":
		return 180
	case "270":
		return 270
	default:
		return 0
	}
}

func main() {
	flag.Parse()
	log.SetFlags(log.Ltime | log.Lshortfile)

	// --restore: just bring back the Kindle UI and exit
	if *restore {
		kindleRestore()
		return
	}

	dur, err := time.ParseDuration(interval)
	if err != nil {
		log.Fatalf("bad interval %q: %v", interval, err)
	}

	// Kill Kindle UI and disable screensaver
	kindlePrep()

	// Restore Kindle UI on exit (SIGINT, SIGTERM, or normal return)
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		log.Print("received signal, restoring Kindle UI…")
		kindleRestore()
		os.Exit(0)
	}()

	client := &http.Client{Timeout: 10 * time.Second}

	if *oneshot {
		if err := fetchConvertDisplay(client,true); err != nil {
			log.Printf("ERROR: %v", err)
		}
		kindleRestore()
		return
	}

	log.Printf("tileboard_kindle starting — fetching %s every %s", fetchURL, dur)
	counter:=0
	for {

		if err := fetchConvertDisplay(client,((counter)%int(3600/dur.Seconds()))==0); err != nil {
			log.Printf("ERROR: %v", err)
		}
		time.Sleep(dur)
		counter+=1
	}
}

// ---- fetch → grayscale → write → display ----

func fetchConvertDisplay(client *http.Client,fullUpdate bool) error {
	// 1. Fetch
	pngBytes, err := fetchPNG(client, fetchURL)
	if err != nil {
		return fmt.Errorf("fetch: %w", err)
	}

	// 2. Decode
	src, _, err := image.Decode(bytes.NewReader(pngBytes))
	if err != nil {
		return fmt.Errorf("decode: %w", err)
	}

	// 3. Convert to 8-bit grayscale (fast Pix-slice path)
	gray := toGray(src)

	// 3.5 Optional rotation
	if *rotateFl != 0 {
		gray = rotateImage(gray, *rotateFl)
	}

	// 4. Encode to temp file
	if err := writePNG(gray, outputPath); err != nil {
		return fmt.Errorf("write: %w", err)
	}

	// 5. Display
	if err := displayEips(outputPath,fullUpdate); err != nil {
		return fmt.Errorf("eips: %w", err)
	}

	log.Printf("OK  %dx%d  %d bytes", src.Bounds().Dx(), src.Bounds().Dy(), len(pngBytes))
	return nil
}

// ---- Kindle UI management ----

func kindlePrep() {
	log.Print("stopping Kindle GUI…")
	_ = stopService("framework")
	_ = stopService("lab126_gui")
	_ = stopService("otaupd")
	_ = stopService("phd")
	_ = stopService("tmd")
	_ = stopService("x")
	_ = stopService("todo")
	_ = stopService("mcsd")

	log.Print("disabling screensaver…")
	_ = exec.Command("lipc-set-prop", "com.lab126.powerd", "preventScreenSaver", "1").Run()
}

func kindleRestore() {
	log.Print("re-enabling screensaver…")
	_ = exec.Command("lipc-set-prop", "com.lab126.powerd", "preventScreenSaver", "0").Run()

	log.Print("starting Kindle GUI…")
	_ = startService("mcsd")
	_ = startService("todo")
	_ = startService("x")
	_ = startService("tmd")
	_ = startService("phd")
	_ = startService("otaupd")
	_ = startService("lab126_gui")
	_ = startService("framework")
}

func stopService(name string) error {
	log.Printf("  stop %s", name)
	return exec.Command("stop", name).Run()
}

func startService(name string) error {
	log.Printf("  start %s", name)
	return exec.Command("start", name).Run()
}

// ---- fetch ----

func fetchPNG(client *http.Client, url string) ([]byte, error) {
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", userAgent)

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}

// ---- grayscale conversion (fast, zero-alloc per pixel) ----

func toGray(src image.Image) *image.Gray {
	bounds := src.Bounds()
	gray := image.NewGray(bounds)

	switch s := src.(type) {
	case *image.RGBA:
		for i, j := 0, 0; i < len(s.Pix); i, j = i+4, j+1 {
			r, g, b := int(s.Pix[i]), int(s.Pix[i+1]), int(s.Pix[i+2])
			gray.Pix[j] = uint8((19595*r + 38470*g + 7471*b) >> 16)
		}
	case *image.NRGBA:
		for i, j := 0, 0; i < len(s.Pix); i, j = i+4, j+1 {
			r, g, b := int(s.Pix[i]), int(s.Pix[i+1]), int(s.Pix[i+2])
			gray.Pix[j] = uint8((19595*r + 38470*g + 7471*b) >> 16)
		}
	case *image.Gray:
		copy(gray.Pix, s.Pix)
	default:
		// Fallback for YCbCr, paletted, etc.
		for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
			for x := bounds.Min.X; x < bounds.Max.X; x++ {
				gray.Set(x, y, color.GrayModel.Convert(src.At(x, y)))
			}
		}
	}
	return gray
}

// ---- clockwise rotation (0, 90, 180, 270) on a *Gray image ----

func rotateImage(img image.Image, deg int) *image.Gray {
	if deg == 0 {
		if g, ok := img.(*image.Gray); ok {
			return g
		}
		return toGray(img)
	}

	// Ensure we have a *Gray
	src, ok := img.(*image.Gray)
	if !ok {
		src = toGray(img)
	}

	bounds := src.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	srcPix := src.Pix
	srcStride := src.Stride

	switch deg {
	case 90:
		// 90° clockwise: (x,y) → (h-1-y, x)
		dst := image.NewGray(image.Rect(0, 0, h, w))
		dstPix := dst.Pix
		dstStride := dst.Stride
		for sy := 0; sy < h; sy++ {
			for sx := 0; sx < w; sx++ {
				dx := h - 1 - sy
				dy := sx
				dstPix[dy*dstStride+dx] = srcPix[sy*srcStride+sx]
			}
		}
		return dst

	case 180:
		// 180°: (x,y) → (w-1-x, h-1-y)
		dst := image.NewGray(bounds)
		dstPix := dst.Pix
		dstStride := dst.Stride
		for sy := 0; sy < h; sy++ {
			for sx := 0; sx < w; sx++ {
				dx := w - 1 - sx
				dy := h - 1 - sy
				dstPix[dy*dstStride+dx] = srcPix[sy*srcStride+sx]
			}
		}
		return dst

	case 270:
		// 270° clockwise (90° CCW): (x,y) → (y, w-1-x)
		dst := image.NewGray(image.Rect(0, 0, h, w))
		dstPix := dst.Pix
		dstStride := dst.Stride
		for sy := 0; sy < h; sy++ {
			for sx := 0; sx < w; sx++ {
				dx := sy
				dy := w - 1 - sx
				dstPix[dy*dstStride+dx] = srcPix[sy*srcStride+sx]
			}
		}
		return dst

	default:
		log.Printf("rotateImage: unsupported angle %d, returning unrotated", deg)
		return src
	}
}

// ---- write PNG to disk ----

func writePNG(img image.Image, path string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return png.Encode(f, img)
}

// ---- eips display ----

func displayEips(path string,fullUpdate bool) error {
    if (fullUpdate){
        return exec.Command("eips","-w","reagl","-f", "-g", path).Run()
    }
	return exec.Command("eips", "-g", path).Run()
}
