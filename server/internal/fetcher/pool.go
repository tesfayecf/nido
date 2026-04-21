package fetcher

import (
	"bytes"
	"io"
)

func (c *HTTPClient) readPayload(reader io.Reader) ([]byte, int, error) {
	buffer := c.acquireBuffer()
	defer c.releaseBuffer(buffer)

	if _, err := buffer.ReadFrom(reader); err != nil {
		return nil, 0, err
	}

	payload := append([]byte(nil), buffer.Bytes()...)
	return payload, len(payload), nil
}

func (c *HTTPClient) acquireBuffer() *bytes.Buffer {
	buffer := c.buffers.Get().(*bytes.Buffer)
	buffer.Reset()
	return buffer
}

func (c *HTTPClient) releaseBuffer(buffer *bytes.Buffer) {
	if buffer == nil {
		return
	}

	buffer.Reset()
	c.buffers.Put(buffer)
}
