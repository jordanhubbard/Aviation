# Multi-player Shared Airspace

class MultiplayerSharedAirspace:
    def __init__(self, network_service):
        self.network_service = network_service
        self.connected_players = []

    def connect_player(self, player_id):
        """Connect a player to the shared airspace."""
        if player_id not in self.connected_players:
            self.connected_players.append(player_id)
            self.network_service.notify_connection(player_id)

    def disconnect_player(self, player_id):
        """Disconnect a player from the shared airspace."""
        if player_id in self.connected_players:
            self.connected_players.remove(player_id)
            self.network_service.notify_disconnection(player_id)

    def update_player_position(self, player_id, position):
        """Update the position of a player in the shared airspace."""
        if player_id in self.connected_players:
            self.network_service.update_position(player_id, position)

    def broadcast_airspace_state(self):
        """Broadcast the current state of the airspace to all players."""
        airspace_state = self.network_service.get_airspace_state()
        for player_id in self.connected_players:
            self.network_service.send_state(player_id, airspace_state)

# Example usage
# multiplayer_airspace = MultiplayerSharedAirspace(network_service)
# multiplayer_airspace.connect_player('player1')
# multiplayer_airspace.update_player_position('player1', position)
