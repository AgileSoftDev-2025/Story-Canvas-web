import json
import re
import os
import replicate
import random
from typing import Dict, List
from django.conf import settings
from stories.models import UserStory
from bs4 import BeautifulSoup

class ScenarioGenerator:
    def __init__(self):
        self.model_id = getattr(settings, 'MODEL_ID', 'ibm-granite/granite-3.3-8b-instruct')
    
    def generate_comprehensive_scenarios(self, user_story, html_content=None, scenario_types=None):
        """Main function to generate scenarios - SIMPLIFIED VERSION"""
        # Check if user_story is a dictionary
        if isinstance(user_story, dict):
            # Handle dictionary input
            role = user_story.get('role', 'User')
            action = user_story.get('action', '')
            story_text = user_story.get('story_text', '') or user_story.get('text', '')
            print(f"🧠 Generating comprehensive scenarios for DICT: {role} - {action}")
        else:
            # Handle object input (backward compatibility)
            try:
                role = user_story.role
                action = user_story.action
                story_text = getattr(user_story, 'story_text', '') or getattr(user_story, 'text', '')
                print(f"🧠 Generating comprehensive scenarios for OBJECT: {role} - {action}")
            except AttributeError as e:
                print(f"❌ Error accessing user story attributes: {e}")
                return []
        
        # Parse user story to get components
        actor, action, goal = self.parse_user_story(user_story)
        
        if not action:
            print("❌ Could not parse user story action")
            return []
        
        # Don't clean the text - just use as is
        print(f"   Parsed: Actor='{actor}', Action='{action}', Goal='{goal}'")
        
        # Detect domain
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
        
        # Use your existing scenario generation methods (they should still work)
        scenarios = self._generate_scenarios_by_type(
            actor, action, goal, domain, ui_elements, needed_types
        )
        
        # Validate and complete scenarios
        validated_scenarios = self.validate_and_complete_scenarios(scenarios)
        
        # LLM enhancement
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
    
    def detect_needed_scenario_types(self, actor, action, goal, domain):
        """ULTIMATE FLAWLESS scenario type detection - EXACT SAME AS COLAB"""
        # Normalize inputs
        actor_lower = str(actor).lower() if actor else "user"
        action_lower = str(action).lower() if action else "use system"
        goal_lower = str(goal).lower() if goal else "achieve goal"
        domain_lower = str(domain).lower() if domain else "general"

        # Start with guaranteed minimum
        needed_types = {"happy_path"}  # Always include happy path

        # ===== DOMAIN-SPECIFIC GUARANTEES =====

        # GAMING DOMAIN - Maximum coverage (gaming needs rich scenarios)
        if any(gaming_word in domain_lower for gaming_word in ['game', 'gaming', 'player', 'play', 'entertainment']):
            return {"happy_path", "alternate_path", "exception_path", "boundary_path"}

        # CRITICAL DOMAINS - Full coverage for important systems
        critical_domains = {
            'healthcare': ['health', 'medical', 'patient', 'doctor', 'hospital', 'clinic'],
            'finance': ['bank', 'financial', 'payment', 'transaction', 'money', 'investment'],
            'security': ['security', 'auth', 'login', 'access', 'permission', 'admin'],
            'ecommerce': ['shop', 'store', 'cart', 'checkout', 'payment', 'purchase']
        }

        for critical_domain, keywords in critical_domains.items():
            if any(keyword in domain_lower for keyword in keywords):
                return {"happy_path", "alternate_path", "exception_path", "boundary_path"}

        # ===== ACTION-BASED INTELLIGENT DETECTION =====

        # COMPREHENSIVE ALTERNATE PATH DETECTION
        alternate_indicators = [
            # Navigation and access
            'navigate', 'browse', 'explore', 'access', 'view', 'search', 'find', 'discover',
            # Creation and management
            'create', 'add', 'build', 'make', 'manage', 'organize', 'arrange', 'sort', 'filter',
            # Customization
            'customize', 'personalize', 'configure', 'setup', 'adjust', 'modify',
            # Selection and choice
            'select', 'choose', 'pick', 'decide', 'option', 'preference',
            # Multi-step processes
            'process', 'workflow', 'procedure', 'sequence', 'steps',
            # Analysis and reporting
            'analyze', 'report', 'review', 'assess', 'evaluate', 'measure',
            # Communication
            'communicate', 'share', 'send', 'receive', 'message', 'notify',
            # Gaming-specific alternates
            'play', 'compete', 'level', 'score', 'rank', 'upgrade', 'progress'
        ]

        # Check for alternate path opportunities
        has_alternates = any(indicator in action_lower for indicator in alternate_indicators)

        # Complex actions (more than 4 words) almost always have alternates
        is_complex_action = len(action_lower.split()) > 4

        # Actions with multiple verbs suggest alternates
        has_multiple_verbs = len([word for word in action_lower.split() if word in ['and', 'or', 'with']]) > 0

        if has_alternates or is_complex_action or has_multiple_verbs:
            needed_types.add("alternate_path")

        # ===== COMPREHENSIVE EXCEPTION PATH DETECTION =====

        exception_indicators = [
            # User input and data entry
            'input', 'enter', 'type', 'submit', 'save', 'upload', 'download',
            # System operations
            'process', 'generate', 'calculate', 'compute', 'execute', 'run',
            # Data management
            'delete', 'remove', 'update', 'modify', 'change', 'edit',
            # Authentication and security
            'login', 'register', 'authenticate', 'verify', 'validate',
            # Transactions and payments
            'pay', 'purchase', 'buy', 'transaction', 'transfer',
            # Network and connectivity
            'connect', 'sync', 'load', 'fetch', 'retrieve',
            # System state changes
            'start', 'stop', 'pause', 'resume', 'cancel',
            # Error-prone operations
            'import', 'export', 'backup', 'restore', 'recover'
        ]

        # Check for exception-prone operations
        has_exceptions = any(indicator in action_lower for indicator in exception_indicators)

        # Actions involving user data or system state are exception-prone
        involves_data = any(word in action_lower for word in ['data', 'file', 'information', 'record', 'document'])
        involves_system = any(word in action_lower for word in ['system', 'application', 'software', 'platform'])

        if has_exceptions or involves_data or involves_system:
            needed_types.add("exception_path")

        # ===== COMPREHENSIVE BOUNDARY PATH DETECTION =====

        boundary_indicators = [
            # Limits and extremes
            'limit', 'maximum', 'minimum', 'max', 'min', 'threshold', 'capacity',
            # Ranges and scales
            'range', 'scale', 'spectrum', 'continuum', 'gradient',
            # First/last scenarios
            'first', 'last', 'initial', 'final', 'beginning', 'end',
            # Empty/full states
            'empty', 'full', 'zero', 'complete', 'total', 'all', 'none',
            # Edge cases
            'edge', 'corner', 'boundary', 'extreme', 'rare', 'unusual',
            # Multiple instances
            'multiple', 'many', 'several', 'various', 'different',
            # Time-based boundaries
            'timeout', 'expire', 'duration', 'period', 'interval'
        ]

        # Check for boundary conditions
        has_boundaries = any(indicator in action_lower for indicator in boundary_indicators)

        # Actions involving quantities or measurements suggest boundaries
        involves_quantities = any(word in action_lower for word in ['number', 'count', 'amount', 'quantity', 'size'])
        involves_measurements = any(word in action_lower for word in ['measure', 'calculate', 'estimate', 'rate', 'score'])

        if has_boundaries or involves_quantities or involves_measurements:
            needed_types.add("boundary_path")

        # ===== CONTEXT-AWARE ENHANCEMENTS =====

        # ACTOR-BASED ENHANCEMENTS
        admin_actors = ['admin', 'administrator', 'manager', 'supervisor', 'moderator']
        if any(admin_word in actor_lower for admin_word in admin_actors):
            # Admin actions often need exception and boundary testing
            needed_types.add("exception_path")
            needed_types.add("boundary_path")

        # GOAL-BASED ENHANCEMENTS
        security_goals = ['secure', 'protect', 'prevent', 'avoid', 'safety']
        performance_goals = ['fast', 'quick', 'efficient', 'optimize', 'performance']

        if any(security_word in goal_lower for security_word in security_goals):
            needed_types.add("exception_path")
            needed_types.add("boundary_path")

        if any(performance_word in goal_lower for performance_word in performance_goals):
            needed_types.add("boundary_path")

        # ===== GUARANTEED MINIMUM COVERAGE RULES =====

        # RULE 1: All stories get at least 2 scenario types
        if len(needed_types) < 2:
            additional_types = ["alternate_path", "exception_path", "boundary_path"]
            for add_type in additional_types:
                if add_type not in needed_types:
                    needed_types.add(add_type)
                    if len(needed_types) >= 2:
                        break

        # RULE 2: Complex domains get at least 3 scenario types
        complex_domains = ['enterprise', 'critical', 'production', 'commercial']
        if any(complex_word in domain_lower for complex_word in complex_domains) and len(needed_types) < 3:
            additional_types = [t for t in ["alternate_path", "exception_path", "boundary_path"] if t not in needed_types]
            for add_type in additional_types[:3 - len(needed_types)]:
                needed_types.add(add_type)

        # RULE 3: Never return only happy path
        if needed_types == {"happy_path"}:
            needed_types.update(["alternate_path", "exception_path"])

        # RULE 4: Ensure balanced distribution for important actions
        important_actions = ['create', 'delete', 'update', 'payment', 'login', 'register']
        if any(important_action in action_lower for important_action in important_actions):
            if len(needed_types) < 3:
                needed_types.update(["alternate_path", "exception_path", "boundary_path"])

        # ===== FINAL VALIDATION AND ENHANCEMENT =====

        # Ensure we never return empty or single-type sets
        if len(needed_types) == 0:
            needed_types = {"happy_path", "alternate_path", "exception_path"}

        if len(needed_types) == 1:
            needed_types.update(["alternate_path", "exception_path"])

        # For maximum coverage in uncertain cases, default to comprehensive
        uncertain_conditions = [
            len(action_lower.split()) <= 2,  # Very short action
            'test' in action_lower,          # Testing-related
            'unknown' in action_lower,       # Uncertain context
            len(needed_types) < 2            # Still insufficient coverage
        ]

        if any(uncertain_conditions):
            needed_types = {"happy_path", "alternate_path", "exception_path", "boundary_path"}

        # ===== DOMAIN-SPECIFIC OVERRIDES =====

        # GAMING OVERRIDE - Always maximum coverage
        if any(gaming_word in domain_lower for gaming_word in ['game', 'gaming', 'player', 'play']):
            return {"happy_path", "alternate_path", "exception_path", "boundary_path"}

        # MOBILE APP OVERRIDE - Rich interaction scenarios
        if any(mobile_word in domain_lower for mobile_word in ['mobile', 'app', 'ios', 'android']):
            if len(needed_types) < 3:
                needed_types.update(["alternate_path", "exception_path", "boundary_path"])

        # ENTERPRISE OVERRIDE - Comprehensive testing
        if any(enterprise_word in domain_lower for enterprise_word in ['enterprise', 'business', 'corporate']):
            return {"happy_path", "alternate_path", "exception_path", "boundary_path"}

        # ===== FINAL GUARANTEE =====

        # ABSOLUTE MINIMUM: At least 2 scenario types, preferably 3+
        if len(needed_types) < 2:
            return {"happy_path", "alternate_path", "exception_path"}

        # PREFERRED: 3+ scenario types for good coverage
        if len(needed_types) < 3:
            # Add the most valuable missing type
            missing_types = [t for t in ["alternate_path", "exception_path", "boundary_path"] if t not in needed_types]
            if missing_types:
                needed_types.add(missing_types[0])

        return needed_types

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

    def generate_happy_path_scenarios(self, actor, action, goal, domain, ui_elements):
        """Generate main success scenarios with detailed steps - EXACT SAME AS COLAB"""
        scenarios = []
        actor_name = self.get_natural_actor_name(actor)

        # Template 1: Standard Happy Path
        happy_path_1 = f"""Scenario: Happy Path - Successfully {action}
  Given {actor_name} wants to {action}
  And they have access to the required features
  When they navigate to the appropriate section
  And they complete all necessary steps for {action}
  Then the system processes the request successfully
  And {goal}
  And they receive confirmation of completion"""

        # Template 2: Step-by-Step Happy Path
        happy_path_2 = f"""Scenario: Complete {action} workflow successfully
  Given {actor_name} is authenticated in the system
  And they have the necessary permissions to {action}
  When they initiate the {action} process
  And they provide all required information
  And they confirm their submission
  Then the system validates the input
  And processes the request efficiently
  And {goal}
  And provides clear success feedback"""

        scenarios.extend([happy_path_1, happy_path_2])

        # Add UI-specific happy path if elements available
        if ui_elements:
            ui_context = "\n  And ".join([f"they see the {element}" for element in ui_elements[:3]])
            ui_happy_path = f"""Scenario: Happy Path - {action} using interface elements
  Given {actor_name} accesses the application
  {ui_context}
  When they interact with the appropriate controls
  And follow the workflow for {action}
  Then the system responds appropriately
  And {goal}
  And the interface updates to reflect completion"""
            scenarios.append(ui_happy_path)

        return scenarios[:2]  # Return max 2 happy paths

    def generate_alternate_path_scenarios(self, actor, action, goal, domain, ui_elements):
        """Generate alternate ways to achieve the same goal - EXACT SAME AS COLAB"""
        scenarios = []
        actor_name = self.get_natural_actor_name(actor)
        action_lower = action.lower()

        # Common alternate paths across domains
        alternate_templates = [
            f"""Scenario: Alternate Path - {action} using quick method
  Given {actor_name} needs to {action} efficiently
  And they prefer a streamlined approach
  When they choose the quick access option
  And they provide minimal required information
  Then the system processes the simplified request
  And {goal}
  And they can add details later if needed""",

            f"""Scenario: Alternate Path - {action} with advanced options
  Given {actor_name} wants more control over {action}
  And they have specific preferences or requirements
  When they select advanced configuration options
  And they customize the settings for their needs
  Then the system applies the customizations
  And {goal}
  And the experience is tailored to their preferences"""
        ]

        # Domain-specific alternate paths
        if domain == "mental_health":
            if any(word in action_lower for word in ['mood', 'track', 'log']):
                alternates = [
                    f"""Scenario: Alternate Path - {action} using voice input
  Given {actor_name} prefers hands-free interaction
  And they want to {action} while multitasking
  When they use the voice command feature
  And they describe their emotional state verbally
  Then the system accurately interprets their speech
  And {goal}
  And provides audio confirmation""",

                    f"""Scenario: Alternate Path - {action} with visual aids
  Given {actor_name} responds better to visual cues
  And they want a more engaging experience
  When they use the emotion wheel or color scale
  And they select their current state visually
  Then the system records the visual selection
  And {goal}
  And provides graphical feedback"""
                ]
                alternate_templates.extend(alternates)

        elif domain == "ecommerce":
            if any(word in action_lower for word in ['search', 'find', 'browse']):
                alternates = [
                    f"""Scenario: Alternate Path - {action} using categories
  Given {actor_name} prefers browsing to searching
  And they want to discover related items
  When they navigate through category hierarchies
  And they explore subcategories and filters
  Then the system displays relevant products
  And {goal}
  And suggests complementary items"""
                ]
                alternate_templates.extend(alternates)

        scenarios.extend(alternate_templates[:2])  # Max 2 alternate paths
        return scenarios

    def generate_exception_path_scenarios(self, actor, action, goal, domain, ui_elements):
        """Generate exception and error handling scenarios - EXACT SAME AS COLAB"""
        scenarios = []
        actor_name = self.get_natural_actor_name(actor)
        action_lower = action.lower()

        # Common exception paths
        exception_templates = [
            f"""Scenario: Exception Path - {action} with invalid input
  Given {actor_name} attempts to {action}
  And they provide incomplete or incorrect information
  When they submit the request
  Then the system detects the validation errors
  And displays clear error messages
  And highlights the problematic fields
  And suggests corrections
  And prevents proceeding until issues are resolved""",

            f"""Scenario: Exception Path - {action} during system issues
  Given {actor_name} tries to {action}
  And the system experiences technical problems
  When they attempt to complete the process
  Then the system shows appropriate error states
  And provides recovery options
  And maintains data integrity
  And allows retry when issues are resolved""",

            f"""Scenario: Exception Path - {action} with access restrictions
  Given {actor_name} without proper permissions
  When they attempt to {action}
  Then the system denies access
  And explains the permission requirements
  And suggests alternative actions if available
  And logs the access attempt for security"""
        ]

        # Domain-specific exception paths
        if domain == "mental_health":
            exceptions = [
                f"""Scenario: Exception Path - {action} during emotional crisis
  Given {actor_name} is experiencing severe distress
  And they attempt to {action}
  When the system detects crisis indicators
  Then it provides immediate crisis resources
  And offers emergency contact options
  And continues with the original {action}
  And follows up with additional support""",

                f"""Scenario: Exception Path - {action} with connectivity issues
  Given {actor_name} is in an area with poor internet
  And they need to {action}
  When they attempt the action offline
  Then the system offers offline functionality
  And queues the request for later sync
  And provides clear offline status indicators"""
            ]
            exception_templates.extend(exceptions)

        elif domain == "finance":
            if any(word in action_lower for word in ['payment', 'transfer', 'transaction']):
                exceptions = [
                    f"""Scenario: Exception Path - {action} with insufficient funds
  Given {actor_name} attempts a financial {action}
  And their account has insufficient balance
  When they try to complete the transaction
  Then the system prevents the action
  And explains the fund requirements
  And suggests alternative payment methods
  And provides account balance information"""
                ]
                exception_templates.extend(exceptions)

        scenarios.extend(exception_templates[:2])  # Max 2 exception paths
        return scenarios

    def generate_boundary_path_scenarios(self, actor, action, goal, domain, ui_elements):
        """Generate boundary and edge case scenarios - EXACT SAME AS COLAB"""
        scenarios = []
        actor_name = self.get_natural_actor_name(actor)
        action_lower = action.lower()

        # Common boundary scenarios
        boundary_templates = [
            f"""Scenario: Boundary Case - {action} at system capacity limits
  Given {actor_name} attempts to {action}
  And the system is operating at maximum capacity
  When they initiate the process during peak load
  Then the system maintains acceptable performance
  And processes the request within reasonable time
  And provides appropriate load indicators
  And ensures data integrity throughout""",

            f"""Scenario: Boundary Case - {action} with minimum required data
  Given {actor_name} wants to {action} with minimal information
  And they provide only the absolutely required fields
  When they submit the basic request
  Then the system accepts the minimal valid input
  And processes it successfully
  And prompts for additional optional information
  And maintains core functionality"""
        ]

        # Domain-specific boundary scenarios
        if domain == "mental_health":
            if any(word in action_lower for word in ['mood', 'track', 'log', 'rate']):
                boundaries = [
                    f"""Scenario: Boundary Case - {action} with extreme emotional states
  Given {actor_name} experiences intense emotional extremes
  And attempts to {action} during peak emotional states
  When they record emotions at rating scale boundaries
  Then the system handles extreme values appropriately
  And provides appropriate support resources
  And maintains accurate tracking
  And offers crisis resources if needed""",

                    f"""Scenario: Boundary Case - {action} after long periods of inactivity
  Given {actor_name} returns after extended absence from tracking
  And they have significant historical data gaps
  When they resume {action} after long break
  Then the system welcomes them back appropriately
  And helps them re-establish their tracking routine
  And provides summary of their progress
  And suggests catching up gradually"""
                ]
                boundary_templates.extend(boundaries)

        elif domain == "ecommerce":
            if any(word in action_lower for word in ['search', 'filter', 'browse']):
                boundaries = [
                    f"""Scenario: Boundary Case - {action} with empty or extreme search criteria
  Given {actor_name} uses very broad or very specific search terms
  And the search criteria are at query boundaries
  When they execute the search with boundary parameters
  Then the system handles empty results gracefully
  And provides helpful suggestions for refinement
  And maintains search performance
  And explains result limitations"""
                ]
                boundary_templates.extend(boundaries)

        elif domain == "finance":
            if any(word in action_lower for word in ['transfer', 'payment', 'amount']):
                boundaries = [
                    f"""Scenario: Boundary Case - {action} at transaction limits
  Given {actor_name} attempts a financial {action}
  And the amount is at account or system limits
  When they try to process the boundary amount
  Then the system validates against all limits
  And provides clear limit information
  And suggests appropriate alternatives
  And ensures regulatory compliance"""
                ]
                boundary_templates.extend(boundaries)

        scenarios.extend(boundary_templates[:2])  # Max 2 boundary scenarios
        return scenarios

    def parse_user_story(self, story):
        """ULTIMATE FLAWLESS user story parsing - EXACT SAME AS COLAB"""
        import re

        # ===== INPUT HANDLING - Handle any input type =====
        story_text = ""

        if isinstance(story, UserStory):
            story_text = story.story_text
        elif isinstance(story, dict):
            # Try every possible key that might contain story text
            possible_keys = ['text', 'description', 'story', 'user_story', 'content', 'narrative', 'requirement']
            for key in possible_keys:
                if key in story and story[key]:
                    story_text = str(story[key])
                    break
            # If no text found but we have role/action/goal separately
            if not story_text and all(k in story for k in ['role', 'action', 'goal']):
                return story['role'], story['action'], story['goal']
        else:
            story_text = str(story)

        # If we have absolutely no text, return sensible defaults
        if not story_text or not story_text.strip():
            return "User", "use the system", "achieve their goals"

        # ===== TEXT NORMALIZATION - Handle any formatting =====
        story_text = story_text.strip()

        # Replace all types of quotes and special characters
        story_text = re.sub(r'[“”„‟]', '"', story_text)
        story_text = re.sub(r'[‘’‚‛]', "'", story_text)

        # Normalize whitespace but preserve sentence structure
        story_text = re.sub(r'\s+', ' ', story_text)
        story_text = re.sub(r'\s*([.,;:!?])\s*', r'\1 ', story_text)

        # ===== MULTI-LAYER PARSING STRATEGY =====

        # STRATEGY 1: Comprehensive pattern matching
        patterns = [
            # Standard format with variations
            r'As\s+(?:an?|the)?\s*([^,]+?)(?:,|\s+who|\s+that)?\s+I\s+(?:want\s+to|need\s+to|should\s+be\s+able\s+to|would\s+like\s+to|can)\s+([^.,]+?)\s+(?:so\s+that|in\s+order\s+to|to)\s+([^.,]+)',
            # More flexible format
            r'As\s+([^,]+?)\s*,\s*(?:I\s+)?(?:want|need)\s+([^.,]+?)\s+(?:so that|to)\s+([^.,]+)',
            # Even more flexible
            r'As\s+([^,]+?)\s*,\s*I\s+([^.,]+?)\s+(?:so that|to)\s+([^.,]+)',
            # Catch partial formats
            r'As\s+([^,]+?)\s*,\s*([^.,]+?)\s*\.\s*([^.,]+)',
            # Just look for the structure anywhere
            r'([^,]+?)\s+(?:want to|need to)\s+([^.,]+?)\s+(?:so that|to)\s+([^.,]+)',
        ]

        for pattern in patterns:
            match = re.search(pattern, story_text, re.IGNORECASE | re.DOTALL)
            if match:
                actor, action, goal = match.groups()
                if len(actor.strip()) > 1 and len(action.strip()) > 3 and len(goal.strip()) > 3:
                    return actor.strip(), action.strip(), goal.strip()

        # STRATEGY 2: Sentence structure analysis
        sentences = re.split(r'[.!?]+', story_text)
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue

            words = sentence.split()
            if len(words) < 5:  # Too short to be meaningful
                continue

            # Look for "As X" pattern
            if words[0].lower() == 'as' and len(words) > 2:
                actor_words = []
                i = 1
                while i < len(words) and words[i].lower() not in ['i', 'want', 'need', 'should']:
                    actor_words.append(words[i])
                    i += 1
                if actor_words:
                    actor = ' '.join(actor_words).rstrip(',')

                    # Look for action after "I want to"
                    action_start = -1
                    for j in range(len(words)):
                        if words[j].lower() in ['want', 'need'] and j + 1 < len(words) and words[j + 1].lower() == 'to':
                            action_start = j + 2
                            break

                    if action_start != -1:
                        # Look for goal after "so that" or "to"
                        goal_start = -1
                        for k in range(action_start, len(words)):
                            if words[k].lower() in ['so', 'to'] or (k + 1 < len(words) and f"{words[k]} {words[k+1]}" in ['so that', 'in order']):
                                goal_start = k
                                break

                        if goal_start != -1:
                            action = ' '.join(words[action_start:goal_start])
                            goal = ' '.join(words[goal_start:])
                            return actor, action, goal

        # STRATEGY 3: Keyword-based extraction
        lines = story_text.split('\n')
        for line in lines:
            line = line.strip()

            # Look for any indication of actor
            actor_match = re.search(r'(?:As|Role:|User:|Actor:)\s*([^\n,]+)', line, re.IGNORECASE)
            actor = actor_match.group(1).strip() if actor_match else "User"

            # Look for action indicators
            action_match = re.search(r'(?:want to|need to|should be able to)\s+([^.,]+)', line, re.IGNORECASE)
            action = action_match.group(1).strip() if action_match else ""

            # Look for goal indicators
            goal_match = re.search(r'(?:so that|in order to|to)\s+([^.,]+)', line, re.IGNORECASE)
            goal = goal_match.group(1).strip() if goal_match else ""

            if action or goal:
                return actor, action, goal

        # STRATEGY 4: Smart word-based fallback
        words = story_text.split()
        if len(words) >= 3:
            # First meaningful noun phrase as actor
            actor = words[0] if len(words[0]) > 2 else "User"

            # Middle part as action (avoid first and last 2 words)
            action_start = min(1, len(words) - 3)
            action_end = max(len(words) - 2, action_start + 2)
            action = ' '.join(words[action_start:action_end])

            # Last part as goal
            goal = ' '.join(words[-2:]) if len(words) >= 4 else "achieve their objectives"

            return actor, action, goal

        # STRATEGY 5: Ultimate fallback - extract anything meaningful
        if len(story_text) > 10:
            # Split text into roughly equal parts
            text_len = len(story_text)
            part_len = text_len // 3

            actor = story_text[:part_len].strip()
            action = story_text[part_len:2*part_len].strip()
            goal = story_text[2*part_len:].strip()

            return actor, action, goal

        # STRATEGY 6: Absolute final fallback
        return "User", "use the system", "achieve their goals"

    def infer_domain_from_content(self, action, goal, actor):
        """Detect domain from story content to generate relevant scenarios - EXACT SAME AS COLAB"""
        content = f"{action} {goal} {actor}".lower()

        domains = {
            "healthcare": any(word in content for word in [
                "patient", "doctor", "medical", "health", "appointment", "hospital",
                "prescription", "symptom", "diagnosis", "treatment", "clinic"
            ]),
            "ecommerce": any(word in content for word in [
                "product", "cart", "checkout", "payment", "order", "shop", "buy",
                "purchase", "shipping", "inventory", "catalog"
            ]),
            "education": any(word in content for word in [
                "student", "teacher", "course", "lesson", "assignment", "grade",
                "learn", "study", "classroom", "homework", "quiz"
            ]),
            "finance": any(word in content for word in [
                "account", "transaction", "payment", "bank", "money", "transfer",
                "balance", "investment", "loan", "credit", "debit"
            ]),
            "mental_health": any(word in content for word in [
                "mood", "emotion", "therapy", "meditation", "stress", "anxiety",
                "mental", "wellness", "coping", "mindfulness", "track"
            ]),
            "social": any(word in content for word in [
                "profile", "post", "share", "friend", "follow", "message",
                "comment", "like", "social", "network", "connect"
            ])
        }

        for domain, detected in domains.items():
            if detected:
                return domain
        return "general"

    def get_natural_actor_name(self, actor):
        """Convert formal actor names to natural names - EXACT SAME AS COLAB"""
        # Remove long formal descriptions
        natural_names = {
            "individuals seeking daily mental health maintenance": "a user",
            "users with mild to moderate stress/anxiety": "someone managing stress",
            "administrator": "an admin",
            "customer": "a customer",
            "patient": "a patient",
            "student": "a student",
            "teacher": "a teacher"
        }

        # Direct mapping for common cases
        for formal, natural in natural_names.items():
            if formal.lower() in actor.lower():
                return natural

        # Generic simplification
        if len(actor.split()) > 3:
            return "a user"

        return f"a {actor.lower()}"

    def extract_ui_elements_from_html(self, html_content):
        """Extract readable UI elements from HTML content - EXACT SAME AS COLAB"""
        if not html_content or not isinstance(html_content, str) or not html_content.strip():
            return []

        try:
            soup = BeautifulSoup(html_content, "html.parser")
            seen = []
            add = lambda s: (seen.append(s) if s not in seen else None)

            for inp in soup.find_all("input"):
                itype = (inp.get("type") or "text").lower()
                label = self._find_label_text(soup, inp) or f"{itype} input"
                if itype in ("text", "search"):
                    add(f"text input: {label}")
                elif itype in ("email", "password", "tel", "url", "date", "datetime-local", "number"):
                    add(f"{itype} input: {label}")
                elif itype in ("checkbox", "radio"):
                    add(f"{itype}: {label}")
                elif itype in ("submit", "button", "reset"):
                    add(f"button (input): {label}")
                elif itype == "file":
                    add(f"file input: {label}")
                else:
                    add(f"{itype} input: {label}")

            for ta in soup.find_all("textarea"):
                label = self._find_label_text(soup, ta) or "textarea"
                add(f"textarea: {label}")

            for sel in soup.find_all("select"):
                label = self._find_label_text(soup, sel) or "select"
                options = [o.text.strip() for o in sel.find_all("option") if o.text.strip()]
                if options:
                    preview = ", ".join(options[:5])
                    more = f", +{len(options)-5} more" if len(options) > 5 else ""
                    add(f"select: {label} (options: {preview}{more})")
                else:
                    add(f"select: {label}")

            for btn in soup.find_all("button"):
                text = (btn.text or "").strip()
                label = btn.get("aria-label") or btn.get("title") or text or self._find_label_text(soup, btn) or "button"
                add(f"button: {label}")

            for a in soup.find_all("a"):
                text = (a.text or "").strip()
                href = a.get("href")
                label = a.get("aria-label") or a.get("title") or text or (href if href else "link")
                add(f"link: {label}")

            candidates = soup.find_all(attrs={"role": True}) + soup.find_all(attrs={"onclick": True}) + soup.find_all(attrs={"tabindex": True})
            for c in candidates:
                role = c.get("role", "").strip()
                if role in ("button", "link", "menuitem", "option") or c.get("onclick") or c.get("tabindex"):
                    label = self._find_label_text(soup, c) or (c.text or "").strip() or role or c.name
                    add(f"{c.name}[role={role or 'n/a'}]: {label}")

            for form in soup.find_all("form"):
                fname = form.get("name") or form.get("id") or form.get("action")
                if fname:
                    add(f"form: {fname}")

            return seen
        except Exception as e:
            print(f"Error parsing HTML: {e}")
            return []

    def _find_label_text(self, soup, elem):
        """Try many heuristics to get a human label for elem - EXACT SAME AS COLAB"""
        for attr in ("aria-label", "title", "placeholder", "name", "id", "data-testid", "data-test"):
            val = elem.get(attr)
            if val and isinstance(val, str) and val.strip():
                return val.strip()

        elem_id = elem.get("id")
        if elem_id:
            lbl = soup.find("label", attrs={"for": elem_id})
            if lbl and lbl.text.strip():
                return lbl.text.strip()

        parent = elem.find_parent("label")
        if parent and parent.text.strip():
            return parent.text.strip()

        aria_by = elem.get("aria-labelledby")
        if aria_by:
            texts = []
            for bid in aria_by.split():
                tnode = soup.find(id=bid.strip())
                if tnode and tnode.text.strip():
                    texts.append(tnode.text.strip())
            if texts:
                return " ".join(texts)

        return None

    def validate_and_complete_scenarios(self, scenarios):
        """Ensure every scenario has proper Gherkin structure and type labeling - EXACT SAME AS COLAB"""
        completed_scenarios = []

        for scenario_text in scenarios:
            lines = scenario_text.strip().split('\n')

            # Check if scenario has proper type labeling
            first_line = lines[0].strip()
            if not any(marker in first_line for marker in ["Happy Path", "Alternate Path", "Exception Path", "Boundary Case"]):
                # Add proper scenario type label
                type_labels = {
                    "happy_path": "Happy Path",
                    "alternate_path": "Alternate Path",
                    "exception_path": "Exception Path",
                    "boundary_path": "Boundary Case"
                }
                
                # Try to infer type from content
                scenario_type = "happy_path"  # default
                if "exception" in first_line.lower() or "error" in first_line.lower():
                    scenario_type = "exception_path"
                elif "alternate" in first_line.lower() or "different" in first_line.lower():
                    scenario_type = "alternate_path"
                elif "boundary" in first_line.lower() or "edge" in first_line.lower():
                    scenario_type = "boundary_path"
                
                type_label = type_labels.get(scenario_type, "Scenario")
                lines[0] = f"Scenario: {type_label} - {first_line.replace('Scenario:', '').strip()}"

            # Check for missing Gherkin keywords
            has_given = any(line.strip().startswith('Given') for line in lines)
            has_when = any(line.strip().startswith('When') for line in lines)
            has_then = any(line.strip().startswith('Then') for line in lines)

            # If missing critical components, try to fix or discard
            if not has_given or not has_when or not has_then:
                print(f"⚠️  Invalid scenario structure detected, attempting to fix...")

                # Try to extract and structure the content
                content_lines = [line for line in lines if not line.strip().startswith('Scenario:')]
                if len(content_lines) >= 2:
                    # Try to structure the first line as Given, second as When, third as Then
                    structured_lines = [lines[0]]  # Keep scenario title

                    if content_lines:
                        if not content_lines[0].strip().startswith('Given'):
                            structured_lines.append(f"  Given {content_lines[0].strip()}")
                        else:
                            structured_lines.append(f"  {content_lines[0].strip()}")

                    if len(content_lines) > 1:
                        if not content_lines[1].strip().startswith('When'):
                            structured_lines.append(f"  When {content_lines[1].strip()}")
                        else:
                            structured_lines.append(f"  {content_lines[1].strip()}")

                    if len(content_lines) > 2:
                        if not content_lines[2].strip().startswith('Then'):
                            structured_lines.append(f"  Then {content_lines[2].strip()}")
                        else:
                            structured_lines.append(f"  {content_lines[2].strip()}")

                    # Add missing And steps for remaining content
                    for i in range(3, len(content_lines)):
                        if content_lines[i].strip():
                            structured_lines.append(f"  And {content_lines[i].strip()}")

                    completed_scenarios.append('\n'.join(structured_lines))
                else:
                    print(f"❌ Cannot fix scenario, discarding: {first_line}")
            else:
                completed_scenarios.append('\n'.join(lines))

        return completed_scenarios

    def enhance_scenarios_with_llm(self, actor, action, goal, base_scenarios, domain, html_content=None, needed_types=None):
        """Use LLM to make scenarios more natural and ensure proper Gherkin structure - EXACT SAME AS COLAB"""
        try:
            ui_elements = self.extract_ui_elements_from_html(html_content) if html_content else []
            ui_context = f"UI Elements available: {', '.join(ui_elements[:5])}" if ui_elements else "Basic form interface"

            if needed_types:
                type_descriptions = {
                    "happy_path": "main success scenarios (ALWAYS include Given/When/Then)",
                    "alternate_path": "different approaches to achieve the same goal",
                    "exception_path": "error handling and system failure scenarios",
                    "boundary_path": "edge cases and system limit scenarios"
                }
                needed_descriptions = [type_descriptions[t] for t in needed_types]
                type_context = f"REQUIRED SCENARIO TYPES: {', '.join(needed_descriptions)}"
            else:
                type_context = "Generate comprehensive scenario coverage"

            prompt = f"""
        DOMAIN: {domain}
        ACTOR: {actor}
        ACTION: {action}
        GOAL: {goal}
        EXISTING SCENARIOS: {base_scenarios}
        {ui_context}
        {type_context}

        CRITICAL REQUIREMENTS FOR EVERY SCENARIO:
        1. EVERY scenario MUST start with: "Scenario: [Type] - [Description]"
           - Types: Happy Path, Alternate Path, Exception Path, Boundary Case
        2. EVERY scenario MUST have:
           - At least ONE "Given" step (preconditions)
           - At least ONE "When" step (actions)
           - At least ONE "Then" step (outcomes)
           - Use "And" for additional steps at the same level
        3. SCENARIO STRUCTURE:
           Scenario: [Type] - [clear description]
             Given [precondition 1]
             And [precondition 2] (if needed)
             When [user action]
             And [additional action] (if needed)
             Then [expected outcome]
             And [additional outcome] (if needed)

        TASK: Fix and enhance these Gherkin scenarios to ensure proper structure:

        EXAMPLES OF CORRECT STRUCTURE:
        Scenario: Happy Path - Complete mood tracking successfully
          Given a user wants to track their emotional state
          And they access the mood tracking feature
          When they enter their current mood and submit
          Then the system saves the mood entry
          And provides personalized coping strategies
          And the user can view their mood history

        Scenario: Exception Path - Mood tracking with invalid input
          Given a user attempts to log their mood
          When they submit incomplete or invalid data
          Then the system displays validation errors
          And highlights the required fields
          And prevents submission until corrections are made

        Return ONLY the corrected and enhanced scenarios in proper Gherkin format.
        Ensure EVERY scenario has the required Given/When/Then structure.
        """

            llm_output = self._call_llm_api(prompt, temperature=0.7, max_tokens=2500)
            enhanced_scenarios = self.parse_llm_scenario_output(llm_output)

            # Additional validation on the enhanced scenarios
            validated_scenarios = []
            for scenario in enhanced_scenarios:
                validated = self.validate_and_complete_scenarios([scenario])
                if validated:
                    validated_scenarios.extend(validated)

            return validated_scenarios if validated_scenarios else base_scenarios

        except Exception as e:
            print(f"LLM enhancement failed: {e}")
            # Fallback: validate existing scenarios
            validated_scenarios = []
            for scenario in base_scenarios:
                validated = self.validate_and_complete_scenarios([scenario])
                if validated:
                    validated_scenarios.extend(validated)
            return validated_scenarios

    def parse_llm_scenario_output(self, llm_output):
        """Parse LLM output to extract clean Gherkin scenarios - EXACT SAME AS COLAB"""
        scenarios = []
        current_scenario = []

        for line in llm_output.split('\n'):
            line = line.strip()
            if line.startswith('Scenario:'):
                if current_scenario:
                    scenarios.append('\n'.join(current_scenario))
                    current_scenario = []
                current_scenario.append(line)
            elif line and (line.startswith('Given') or line.startswith('When') or
                          line.startswith('Then') or line.startswith('And')):
                current_scenario.append(line)
            elif not line and current_scenario:
                # Empty line might indicate scenario end
                if len(current_scenario) > 1:  # At least Scenario + one step
                    scenarios.append('\n'.join(current_scenario))
                    current_scenario = []

        # Don't forget the last scenario
        if current_scenario and len(current_scenario) > 1:
            scenarios.append('\n'.join(current_scenario))

        return scenarios if scenarios else []

    def prepare_scenario_data_for_saving(self, scenario_text, scenario_type, actor, action, goal, domain):
        """Prepare scenario data for saving to database"""
        return {
            'scenario_text': scenario_text,
            'scenario_type': scenario_type,
            'title': self._extract_scenario_title(scenario_text),
            'detected_domain': domain,
            'has_proper_structure': self._check_scenario_structure(scenario_text),
            'gherkin_steps': self._extract_gherkin_steps(scenario_text),
            'enhanced_with_llm': 'LLM' in scenario_text or len(scenario_text) > 200  # Simple heuristic
        }

    def _extract_scenario_title(self, scenario_text):
        """Extract title from scenario text"""
        first_line = scenario_text.split('\n')[0]
        if ' - ' in first_line:
            return first_line.split(' - ')[1].strip()
        elif ':' in first_line:
            return first_line.split(':', 1)[1].strip()
        else:
            return first_line.replace('Scenario:', '').strip()

    def _check_scenario_structure(self, scenario_text):
        """Check if scenario has proper Gherkin structure"""
        lines = scenario_text.split('\n')
        has_given = any(line.strip().startswith('Given') for line in lines)
        has_when = any(line.strip().startswith('When') for line in lines)
        has_then = any(line.strip().startswith('Then') for line in lines)
        return has_given and has_when and has_then

    def _extract_gherkin_steps(self, scenario_text):
        """Extract Gherkin steps from scenario text"""
        steps = []
        for line in scenario_text.split('\n'):
            line = line.strip()
            if line.startswith(('Given', 'When', 'Then', 'And')):
                steps.append(line)
        return steps

    def _call_llm_api(self, prompt, temperature=0.0, max_tokens=1024):
        """Call the LLM API dengan error handling yang lebih baik - EXACT SAME AS COLAB"""
        try:
            api_token = os.getenv('REPLICATE_API_TOKEN')
            
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
        """Fallback response ketika LLM tidak tersedia - EXACT SAME AS COLAB"""
        print("🔧 Using fallback LLM response generator")
        
        # Simple template-based response
        if "scenario" in prompt.lower() and "enhance" in prompt.lower():
            return self._fallback_enhance_scenarios(prompt)
        else:
            return self._generic_fallback_response()
    
    def _fallback_enhance_scenarios(self, prompt):
        """Fallback untuk scenario enhancement - EXACT SAME AS COLAB"""
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
        """Generic fallback response - EXACT SAME AS COLAB"""
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