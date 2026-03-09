# Demo Flight Service

from fastapi import FastAPI
from typing import List, Dict, Any

app = FastAPI()

# In-memory storage for demo scenarios
demo_scenarios: Dict[str, Dict[str, Any]] = {}
flight_recordings: Dict[str, List[Dict[str, Any]]] = {}

@app.get('/api/demo/scenarios')
def list_scenarios() -> List[Dict[str, Any]]:
    """List available demo scenarios"""
    return [
        {
            'id': 'pattern-work',
            'name': 'Pattern Work Training',
            'description': 'Practice takeoff, landing, and go-around procedures'
        },
        {
            'id': 'cross-country',
            'name': 'Cross-Country Flight',
            'description': 'Long-distance navigation and flight planning'
        },
        {
            'id': 'approach-training',
            'name': 'Approach Training',
            'description': 'Practice various approach procedures'
        }
    ]

@app.post('/api/demo/load/{scenario_id}')
def load_scenario(scenario_id: str) -> Dict[str, Any]:
    """Load a demo scenario"""
    return {
        'scenario_id': scenario_id,
        'status': 'loaded',
        'message': f'Scenario {scenario_id} loaded successfully'
    }

@app.post('/api/demo/record')
def start_recording() -> Dict[str, Any]:
    """Start recording a flight"""
    return {
        'recording_id': 'rec_001',
        'status': 'recording',
        'message': 'Flight recording started'
    }

@app.get('/api/demo/download/{recording_id}')
def download_recording(recording_id: str) -> Dict[str, Any]:
    """Download a recorded flight"""
    return {
        'recording_id': recording_id,
        'status': 'ready',
        'message': f'Recording {recording_id} is ready for download'
    }
