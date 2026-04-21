package httpapi

import (
	"bufio"
	"io"
	"log/slog"
	"net"
	"net/http"
	"time"
)

// LoggingMiddleware emits one structured log entry per HTTP request.
func LoggingMiddleware(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		startedAt := time.Now()
		writer := &statusWriter{ResponseWriter: w, statusCode: http.StatusOK}

		next.ServeHTTP(writer, r)

		logger.Info("http request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", writer.statusCode,
			"duration", time.Since(startedAt),
		)
	})
}

type statusWriter struct {
	http.ResponseWriter
	statusCode int
}

func (w *statusWriter) WriteHeader(statusCode int) {
	w.statusCode = statusCode
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *statusWriter) Flush() {
	if flusher, ok := w.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

func (w *statusWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hijacker, ok := w.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, http.ErrNotSupported
	}

	return hijacker.Hijack()
}

func (w *statusWriter) Push(target string, opts *http.PushOptions) error {
	pusher, ok := w.ResponseWriter.(http.Pusher)
	if !ok {
		return http.ErrNotSupported
	}

	return pusher.Push(target, opts)
}

func (w *statusWriter) ReadFrom(reader io.Reader) (int64, error) {
	if readFrom, ok := w.ResponseWriter.(io.ReaderFrom); ok {
		return readFrom.ReadFrom(reader)
	}

	return io.Copy(w.ResponseWriter, reader)
}
