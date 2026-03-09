// Package websocket provides serialization and deserialization for WebSocket messages.

package websocket

import (
	"encoding/json"
	"errors"
)

// SerializeMessage converts a Message struct into a JSON string.
func SerializeMessage(msg Message) (string, error) {
	jsonData, err := json.Marshal(msg)
	if err != nil {
		return "", err
	}
	return string(jsonData), nil
}

// DeserializeMessage converts a JSON string into a Message struct.
func DeserializeMessage(jsonStr string) (Message, error) {
	var msg Message
	if err := json.Unmarshal([]byte(jsonStr), &msg); err != nil {
		return Message{}, err
	}
	if msg.Type == "" {
		return Message{}, errors.New("invalid message type")
	}
	return msg, nil
}
