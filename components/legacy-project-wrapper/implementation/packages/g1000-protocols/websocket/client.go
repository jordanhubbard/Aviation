// Package websocket provides a client for connecting to WebSocket servers.

package websocket

import (
	"github.com/gorilla/websocket"
)

// Client represents a WebSocket client.
type Client struct {
	conn *websocket.Conn
}

// NewClient creates a new WebSocket client and connects to the server.
func NewClient(url string) (*Client, error) {
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		return nil, err
	}
	return &Client{conn: conn}, nil
}

// SendMessage sends a message to the WebSocket server.
func (c *Client) SendMessage(msg Message) error {
	serializedMsg, err := SerializeMessage(msg)
	if err != nil {
		return err
	}
	return c.conn.WriteMessage(websocket.TextMessage, []byte(serializedMsg))
}

// Close closes the WebSocket connection.
func (c *Client) Close() error {
	return c.conn.Close()
}
