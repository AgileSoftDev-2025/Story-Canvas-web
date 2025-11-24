# stories/services/scenario_services.py
import requests
from django.conf import settings

class ScenarioService:
    def __init__(self):
        self.base_url = getattr(settings, 'API_BASE_URL', 'http://localhost:8000/api')
    
    def get_story_scenarios(self, story_id):
        """Get scenarios for a user story"""
        try:
            response = requests.get(f"{self.base_url}/user-stories/{story_id}/scenarios/")
            if response.status_code == 200:
                return response.json()
            else:
                return {'success': False, 'error': 'Failed to fetch scenarios'}
        except requests.RequestException as e:
            return {'success': False, 'error': str(e)}
    
    def generate_scenarios(self, story_id, scenario_types=None, html_content=None):
        """Generate scenarios using AI"""
        try:
            payload = {}
            if scenario_types:
                payload['scenario_types'] = scenario_types
            if html_content:
                payload['html_content'] = html_content
            
            response = requests.post(
                f"{self.base_url}/user-stories/{story_id}/generate-scenarios/",
                json=payload
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {'success': False, 'error': 'Failed to generate scenarios'}
        except requests.RequestException as e:
            return {'success': False, 'error': str(e)}
    
    def accept_scenarios(self, story_id, scenario_ids=None):
        """Accept scenarios for a user story"""
        try:
            payload = {}
            if scenario_ids:
                payload['scenario_ids'] = scenario_ids
            
            response = requests.post(
                f"{self.base_url}/user-stories/{story_id}/accept-scenarios/",
                json=payload
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {'success': False, 'error': 'Failed to accept scenarios'}
        except requests.RequestException as e:
            return {'success': False, 'error': str(e)}
    
    def update_scenario(self, scenario_id, update_data):
        """Update a scenario"""
        try:
            response = requests.put(
                f"{self.base_url}/scenarios/{scenario_id}/update/",
                json=update_data
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {'success': False, 'error': 'Failed to update scenario'}
        except requests.RequestException as e:
            return {'success': False, 'error': str(e)}
    
    def delete_scenario(self, scenario_id):
        """Delete a scenario"""
        try:
            response = requests.delete(f"{self.base_url}/scenarios/{scenario_id}/delete/")
            
            if response.status_code == 200:
                return response.json()
            else:
                return {'success': False, 'error': 'Failed to delete scenario'}
        except requests.RequestException as e:
            return {'success': False, 'error': str(e)}