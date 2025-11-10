# stories/utils/scenario_generator.py
import json
import re
import os
import replicate
from django.conf import settings
from stories.models import UserStory

class ScenarioGenerator:
    def __init__(self):
        self.model_id = "ibm-granite/granite-3.3-8b-instruct"
    
    def generate_comprehensive_scenarios(self, user_story, html_content=None, scenario_types=None):
        """Main function to generate scenarios - mirrors original logic"""
        print(f"🧠 Generating comprehensive scenarios for: {user_story.role} - {user_story.action}")
        
        # Parse user story to get components
        actor, action, goal = self.parse_user_story(user_story)
        
        if not action:
            print("❌ Could not parse user story action")
            return []
        
        # Detect domain and needed scenario types
        domain = self.infer_domain_from_content(action, goal, actor)
        print(f"   Detected Domain: {domain}")
        
        # Extract UI elements from HTML if available
        ui_elements = self.extract_ui_elements_from_html(html_content) if html_content else []
        if ui_elements:
            print(f"   Found {len(ui_elements)} UI elements for context")
        
        # Determine which scenario types are needed
        if scenario_types:
            needed_types = scenario_types
        else:
            needed_types = self.detect_needed_scenario_types(actor, action, goal, domain)
        
        print(f"   Needed Scenario Types: {', '.join(needed_types)}")
        
        # Generate scenarios
        scenarios = self._generate_scenarios_by_type(
            actor, action, goal, domain, ui_elements, needed_types
        )
        
        # Validate and complete scenarios
        validated_scenarios = self.validate_and_complete_scenarios(scenarios)
        
        # LLM enhancement for natural language
        try:
            enhanced_scenarios = self.enhance_scenarios_with_llm(
                actor, action, goal, validated_scenarios, domain, html_content, needed_types
            )
            if enhanced_scenarios:
                final_scenarios = enhanced_scenarios
            else:
                final_scenarios = validated_scenarios
        except Exception as e:
            print(f"LLM enhancement failed, using validated scenarios: {e}")
            final_scenarios = validated_scenarios
        
        print(f"   ✅ Generated {len(final_scenarios)} scenarios")
        
        # Convert to format untuk disimpan
        scenarios_for_saving = []
        for scenario_text in final_scenarios:
            scenario_data = self.prepare_scenario_data_for_saving(
                scenario_text, 
                self._infer_scenario_type(scenario_text),
                actor, action, goal, domain
            )
            scenarios_for_saving.append(scenario_data)
        
        return scenarios_for_saving
    
    def _infer_scenario_type(self, scenario_text):
        """Infer scenario type dari text"""
        if "Happy Path" in scenario_text:
            return "happy_path"
        elif "Alternate Path" in scenario_text:
            return "alternate_path"
        elif "Exception Path" in scenario_text:
            return "exception_path"
        elif "Boundary Case" in scenario_text:
            return "boundary_path"
        else:
            return "happy_path"  # default
    
    def _generate_scenarios_by_type(self, actor, action, goal, domain, ui_elements, needed_types):
        """Generate scenarios based on needed types"""
        scenarios = []
        
        # Generate only the needed scenario types
        if "happy_path" in needed_types:
            happy_scenarios = self.generate_happy_path_scenarios(actor, action, goal, domain, ui_elements)
            scenarios.extend(happy_scenarios[:2])
        
        if "alternate_path" in needed_types:
            alternate_scenarios = self.generate_alternate_path_scenarios(actor, action, goal, domain, ui_elements)
            scenarios.extend(alternate_scenarios[:2])
        
        if "exception_path" in needed_types:
            exception_scenarios = self.generate_exception_path_scenarios(actor, action, goal, domain, ui_elements)
            scenarios.extend(exception_scenarios[:2])
        
        if "boundary_path" in needed_types:
            boundary_scenarios = self.generate_boundary_path_scenarios(actor, action, goal, domain, ui_elements)
            scenarios.extend(boundary_scenarios[:2])
        
        return scenarios

    # ... (semua method lainnya TETAP SAMA sampai _call_llm_api)

    def _call_llm_api(self, prompt, temperature=0.0, max_tokens=1024):
        """Call the LLM API dengan error handling yang lebih baik"""
        try:
            api_token = os.getenv('REPLICATE_API_TOKEN')
            if not api_token or api_token == 'your_replicate_api_token_here':
                print("⚠️ Replicate API token not configured. Using fallback scenarios.")
                return self._fallback_llm_response(prompt)
            
            # Initialize client
            client = replicate.Client(api_token=api_token)
            
            input_data = {
                "prompt": prompt,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "top_p": 1.0,
                "stop_sequences": ["\n\n"]
            }
            
            print(f"🔍 Calling LLM API with prompt: {prompt[:200]}...")
            
            # Run the model
            output = client.run(
                self.model_id,
                input=input_data
            )
            
            print(f"✅ LLM API response received")
            
            # Process output based on type
            if isinstance(output, list):
                result = "".join([str(item) for item in output])
            elif isinstance(output, str):
                result = output
            else:
                result = str(output)
            
            return result
            
        except Exception as e:
            print(f"❌ Error calling Replicate API: {e}")
            print("🔄 Using fallback response")
            return self._fallback_llm_response(prompt)
    
    def _fallback_llm_response(self, prompt):
        """Fallback response ketika LLM tidak tersedia"""
        print("🔧 Using fallback LLM response generator")
        
        # Simple template-based response
        if "scenario" in prompt.lower() and "enhance" in prompt.lower():
            return self._fallback_enhance_scenarios(prompt)
        else:
            return self._generic_fallback_response()
    
    def _fallback_enhance_scenarios(self, prompt):
        """Fallback untuk scenario enhancement"""
        fallback_scenarios = [
            """Scenario: Happy Path - Basic Success Flow
  Given a user wants to complete the action
  When they follow the standard procedure
  Then the system processes the request successfully
  And they receive appropriate confirmation""",
            
            """Scenario: Alternate Path - Different Approach  
  Given a user prefers an alternative method
  When they choose a different workflow
  Then the system accommodates the variation
  And the outcome is still successful""",
            
            """Scenario: Exception Path - Error Handling
  Given a user encounters a problem
  When they provide invalid or incomplete data
  Then the system displays helpful error messages
  And guides them toward resolution"""
        ]
        
        return "\n\n".join(fallback_scenarios)
    
    def _generic_fallback_response(self):
        """Generic fallback response"""
        return json.dumps({
            "status": "fallback_mode",
            "message": "LLM service not available, using template scenarios",
            "scenarios": [
                {
                    "text": "As a user, I want to use basic system features so that I can accomplish my tasks",
                    "role": "user",
                    "feature": "General",
                    "acceptance_criteria": ["System is accessible", "Basic functionality works", "User feedback is provided"]
                }
            ]
        })
        
        