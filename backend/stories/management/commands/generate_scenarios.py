# stories/management/commands/generate_scenarios.py
import json
import re
from django.core.management.base import BaseCommand
from django.utils import timezone
from stories.models import Project, UserStory, Scenario, Wireframe, GenerationSession, ProjectHistory
from stories.utils.scenario_generator import ScenarioGenerator

class Command(BaseCommand):
    help = 'Generate Gherkin scenarios for user stories using AI with smart type detection'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--project-id',
            type=str,
            help='Specific project ID to generate scenarios for',
        )
        parser.add_argument(
            '--all-projects',
            action='store_true',
            help='Generate scenarios for all projects with user stories',
        )
        parser.add_argument(
            '--story-id',
            type=str,
            help='Generate scenarios for specific user story only',
        )
        parser.add_argument(
            '--scenario-types',
            type=str,
            help='Comma-separated scenario types to generate (happy_path,alternate_path,exception_path,boundary_case)',
        )
    
    def handle(self, *args, **options):
        self.stdout.write('🚀 Starting AI Scenario Generation with Smart Type Detection...')
        
        generator = ScenarioGenerator()
        
        # Determine which stories to process
        user_stories = self.get_user_stories_to_process(options)
        
        if not user_stories:
            self.stdout.write('❌ No user stories found for scenario generation')
            return
        
        self.stdout.write(f"📋 Processing {len(user_stories)} user stories...")
        
        for user_story in user_stories:
            self.generate_scenarios_for_story(user_story, generator, options)
        
        self.stdout.write(
            self.style.SUCCESS('✅ Scenario generation completed!')
        )
    
    def get_user_stories_to_process(self, options):
        """Get user stories based on command options"""
        if options['story_id']:
            return UserStory.objects.filter(story_id=options['story_id'])
        elif options['project_id']:
            project = Project.objects.get(project_id=options['project_id'])
            return UserStory.objects.filter(project=project)
        elif options['all_projects']:
            return UserStory.objects.filter(scenarios__isnull=True).distinct()
        else:
            # Default: stories without scenarios
            return UserStory.objects.filter(scenarios__isnull=True)
    
    def generate_scenarios_for_story(self, user_story, generator, options):
        """Generate scenarios for a single user story"""
        try:
            # Get relevant wireframe HTML content for context
            wireframe_html = self.get_wireframe_content_for_story(user_story)
            
            # Parse scenario types if specified
            scenario_types = None
            if options['scenario_types']:
                scenario_types = options['scenario_types'].split(',')
            
            # Generate scenarios using comprehensive logic
            scenarios_data = generator.generate_comprehensive_scenarios(
                user_story=user_story,
                html_content=wireframe_html,
                scenario_types=scenario_types
            )
            
            # Save generated scenarios
            saved_scenarios = self.save_scenarios(user_story, scenarios_data)
            
            # Create or update generation session
            session = self.get_or_create_generation_session(user_story.project, user_story.project.user)
            session.scenarios_generated += len(saved_scenarios)
            session.save()
            
            # Create project history
            ProjectHistory.objects.create(
                project=user_story.project,
                user=user_story.project.user,
                generation_session=session,
                action_type='scenarios_generated',
                action_details={
                    'story_id': user_story.story_id,
                    'count': len(saved_scenarios),
                    'types_generated': list(set(s.scenario_type for s in saved_scenarios))
                },
                description=f'Generated {len(saved_scenarios)} scenarios for: {user_story.role} - {user_story.action[:50]}...',
                related_story=user_story
            )
            
            self.stdout.write(
                self.style.SUCCESS(f'✅ Generated {len(saved_scenarios)} scenarios for: {user_story.role} - {user_story.action[:30]}...')
            )
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Failed to generate scenarios for story {user_story.story_id}: {str(e)}')
            )
    
    def get_wireframe_content_for_story(self, user_story):
        """Get relevant wireframe HTML content for context"""
        try:
            # Try to find wireframes related to this story's feature
            wireframes = Wireframe.objects.filter(
                project=user_story.project,
                page_name__icontains=user_story.feature.lower()
            )
            
            if wireframes.exists():
                return wireframes.first().html_content
            
            # Fallback to any wireframe for the project
            fallback_wireframe = Wireframe.objects.filter(project=user_story.project).first()
            return fallback_wireframe.html_content if fallback_wireframe else None
            
        except Exception:
            return None
    
    def get_or_create_generation_session(self, project, user):
        """Get or create generation session for tracking"""
        session, created = GenerationSession.objects.get_or_create(
            project=project,
            user=user,
            status='running',
            defaults={
                'llm_model_used': 'ibm-granite/granite-3.3-8b-instruct',
                'user_stories_generated': 0,
                'wireframes_generated': 0,
                'scenarios_generated': 0,
                'total_iterations': 0
            }
        )
        return session
    
    def save_scenarios(self, user_story, scenarios_data):
        """Save generated scenarios to database"""
        saved_scenarios = []
        
        for scenario_data in scenarios_data:
            scenario = Scenario.objects.create(
                project=user_story.project,
                user_story=user_story,
                scenario_text=scenario_data['scenario_text'],
                scenario_type=scenario_data['scenario_type'],
                title=scenario_data.get('title', ''),
                detected_domain=scenario_data.get('detected_domain', ''),
                has_proper_structure=scenario_data.get('has_proper_structure', True),
                gherkin_steps=scenario_data.get('gherkin_steps', []),
                enhanced_with_llm=scenario_data.get('enhanced_with_llm', False),
                status='draft'
            )
            saved_scenarios.append(scenario)
        
        return saved_scenarios