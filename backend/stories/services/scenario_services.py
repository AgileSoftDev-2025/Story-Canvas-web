# stories/services/scenario_services.py
import requests
from django.conf import settings

class ScenarioService:
    def __init__(self):
        # PERBAIKI: Hapus /api dari base_url
        self.base_url = getattr(settings, 'API_BASE_URL', 'http://localhost:8000')
        # atau gunakan 127.0.0.1 untuk konsistensi
        # self.base_url = 'http://127.0.0.1:8000'
    
    def get_project_scenarios(self, project_id):
        """Get scenarios for a project"""
        try:
            # SEKARANG URL akan menjadi: http://localhost:8000/projects/{id}/scenarios/
            response = requests.get(f"{self.base_url}/projects/{project_id}/scenarios/")
            print(f"🔍 [BACKEND SERVICE] Calling: {self.base_url}/projects/{project_id}/scenarios/")
            print(f"🔍 [BACKEND SERVICE] Response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ [BACKEND SERVICE] Success: {result}")
                return result
            else:
                error_msg = f'Failed to fetch project scenarios: {response.status_code}'
                print(f"❌ [BACKEND SERVICE] {error_msg}")
                return {'success': False, 'error': error_msg}
        except requests.RequestException as e:
            error_msg = f'Request error: {str(e)}'
            print(f"💥 [BACKEND SERVICE] {error_msg}")
            return {'success': False, 'error': error_msg}
    
    def generate_project_scenarios(self, project_id, scenario_types=None, html_content=None):
        """Generate scenarios for a project using AI"""
        try:
            payload = {}
            if scenario_types:
                payload['scenario_types'] = scenario_types
            if html_content:
                payload['html_content'] = html_content
            
            response = requests.post(
                f"{self.base_url}/projects/{project_id}/generate-scenarios/",
                json=payload
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {'success': False, 'error': f'Failed to generate project scenarios: {response.status_code}'}
        except requests.RequestException as e:
            return {'success': False, 'error': str(e)}
    
    def accept_project_scenarios(self, project_id, scenario_ids=None):
        """Accept scenarios for a project"""
        try:
            payload = {}
            if scenario_ids:
                payload['scenario_ids'] = scenario_ids
            
            response = requests.post(
                f"{self.base_url}/projects/{project_id}/accept-scenarios/",
                json=payload
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {'success': False, 'error': f'Failed to accept project scenarios: {response.status_code}'}
        except requests.RequestException as e:
            return {'success': False, 'error': str(e)}
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