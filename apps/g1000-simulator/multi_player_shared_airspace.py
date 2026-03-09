# Multi-Player Shared Airspace

class MultiPlayerSharedAirspace:
    def __init__(self, network_service):
        self.network_service = network_service
        self.players = []

    def connect_player(self, player_id):
        """Connect a player to the shared airspace."""
        if player_id not in self.players:
            self.players.append(player_id)
            self.network_service.connect(player_id)
        return self.players

    def disconnect_player(self, player_id):
        """Disconnect a player from the shared airspace."""
        if player_id in self.players:
            self.players.remove(player_id)
            self.network_service.disconnect(player_id)
        return self.players

    def update_player_position(self, player_id, position):
        """Update the position of a player in the shared airspace."""
        if player_id in self.players:
            self.network_service.update_position(player_id, position)
        return self.network_service.get_positions()

    def broadcast_message(self, message):
        """Broadcast a message to all players in the shared airspace."""
        self.network_service.broadcast(message)
        return "Message broadcasted."

    def get_active_players(self):
        """Get a list of active players in the shared airspace."""
        return self.players
