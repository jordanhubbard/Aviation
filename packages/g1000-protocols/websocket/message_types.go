// Package websocket defines message types and serialization for WebSocket communication.

package websocket

// MessageType represents the type of message being sent or received.
type MessageType string

const (
	// MessageTypeConnect represents a connection initiation message.
	MessageTypeConnect MessageType = "CONNECT"

	// MessageTypeDisconnect represents a disconnection message.
	MessageTypeDisconnect MessageType = "DISCONNECT"

	// MessageTypeData represents a data transmission message.
	MessageTypeData MessageType = "DATA"
)

// Message represents a WebSocket message.
type Message struct {
	Type    MessageType `json:"type"`
	Payload string      `json:"payload"`
}
