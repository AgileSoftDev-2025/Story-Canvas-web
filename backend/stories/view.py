# stories/view.py
import json
import re
import os
import replicate
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import Project, UserStory, Wireframe, Scenario, GenerationSession, ProjectHistory
from .serializers import (
    ProjectSerializer, UserStorySerializer, WireframeSerializer, 
    ScenarioSerializer, GenerationSessionSerializer
)
from .rag_vector_db import ProjectRAGVectorDB
from .rag_config import REPLICATE_API_TOKEN, MODEL_ID, CHROMA_PATH

# Import utility functions yang diperlukan
from .utils.user_story_generator import UserStoryGenerator
from .utils.scenario_generator import ScenarioGenerator
from .utils.wireframe_generator import WireframeGenerator

class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    
    @action(detail=True, methods=['post'])
    def generate_user_stories(self, request, pk=None):
        """Generate user stories dengan RAG patterns"""
        project = self.get_object()
        
        try:
            # Initialize RAG database
            rag_db = ProjectRAGVectorDB()
            
            # Prepare project info
            project_info = self._prepare_project_info(project)
            
            # Generate user stories dengan RAG
            user_stories = self._generate_user_stories_with_rag(project_info, rag_db)
            
            # Save user stories
            saved_stories = self._save_user_stories(project, user_stories)
            
            # Create generation session
            session = GenerationSession.objects.create(
                project=project,
                user=project.user,
                llm_model_used=MODEL_ID,
                user_stories_generated=len(saved_stories),
                status='completed',
                end_time=timezone.now()
            )
            
            # Create project history
            ProjectHistory.objects.create(
                project=project,
                user=project.user,
                generation_session=session,
                action_type='stories_generated',
                action_details={
                    'count': len(saved_stories),
                    'method': 'ai_rag_generation'
                },
                description=f'Generated {len(saved_stories)} user stories using AI + RAG patterns'
            )
            
            return Response({
                'status': 'success',
                'message': f'Generated {len(saved_stories)} user stories',
                'stories': UserStorySerializer(saved_stories, many=True).data,
                'session_id': session.session_id
            })
            
        except Exception as e:
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def generate_wireframes(self, request, pk=None):
        """Generate wireframes dengan RAG UI patterns"""
        project = self.get_object()
        
        try:
            rag_db = ProjectRAGVectorDB()
            user_stories = project.user_stories.all()
            
            if not user_stories.exists():
                return Response({
                    'status': 'error',
                    'message': 'No user stories found. Generate user stories first.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Generate wireframes dengan RAG
            wireframes = self._generate_wireframes_with_rag(project, user_stories, rag_db)
            
            # Save wireframes
            saved_wireframes = self._save_wireframes(project, wireframes)
            
            # Update generation session
            session = GenerationSession.objects.create(
                project=project,
                user=project.user,
                llm_model_used=MODEL_ID,
                wireframes_generated=len(saved_wireframes),
                status='completed',
                end_time=timezone.now()
            )
            
            ProjectHistory.objects.create(
                project=project,
                user=project.user,
                generation_session=session,
                action_type='wireframes_generated',
                action_details={'count': len(saved_wireframes)},
                description=f'Generated {len(saved_wireframes)} wireframes using RAG UI patterns'
            )
            
            return Response({
                'status': 'success',
                'message': f'Generated {len(saved_wireframes)} wireframes',
                'wireframes': WireframeSerializer(saved_wireframes, many=True).data
            })
            
        except Exception as e:
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def generate_scenarios(self, request, pk=None):
        """Generate scenarios dengan smart type detection"""
        project = self.get_object()
        
        try:
            user_stories = project.user_stories.all()
            
            if not user_stories.exists():
                return Response({
                    'status': 'error',
                    'message': 'No user stories found. Generate user stories first.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            scenarios_generated = 0
            all_saved_scenarios = []
            
            for user_story in user_stories:
                scenarios = self._generate_scenarios_for_story(user_story)
                saved_scenarios = self._save_scenarios(user_story, scenarios)
                scenarios_generated += len(saved_scenarios)
                all_saved_scenarios.extend(saved_scenarios)
            
            # Update generation session
            session = GenerationSession.objects.create(
                project=project,
                user=project.user,
                llm_model_used=MODEL_ID,
                scenarios_generated=scenarios_generated,
                status='completed',
                end_time=timezone.now()
            )
            
            ProjectHistory.objects.create(
                project=project,
                user=project.user,
                generation_session=session,
                action_type='scenarios_generated',
                action_details={'count': scenarios_generated},
                description=f'Generated {scenarios_generated} scenarios with smart type detection'
            )
            
            return Response({
                'status': 'success',
                'message': f'Generated {scenarios_generated} scenarios',
                'scenarios': ScenarioSerializer(all_saved_scenarios, many=True).data
            })
            
        except Exception as e:
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['get'])
    def project_analytics(self, request, pk=None):
        """Get project analytics dan statistics"""
        project = self.get_object()
        
        analytics = {
            'project_info': {
                'title': project.title,
                'domain': project.domain,
                'status': project.status,
                'created_date': project.created_date,
                'last_modified': project.last_modified
            },
            'counts': {
                'user_stories': project.user_stories_count,
                'wireframes': project.wireframes_count,
                'scenarios': project.scenarios_count
            },
            'user_stories_by_priority': self._get_stories_by_priority(project),
            'scenarios_by_type': self._get_scenarios_by_type(project),
            'generation_sessions': self._get_generation_stats(project)
        }
        
        return Response({
            'status': 'success',
            'analytics': analytics
        })
    
    def _prepare_project_info(self, project):
        """Prepare project info untuk RAG generation"""
        return {
            "title": project.title,
            "objective": project.objective or "",
            "users": project.users_data or [],
            "features": project.features_data or [],
            "scope": project.scope or "",
            "flow": project.flow or "",
            "additional_info": project.additional_info or "",
            "domain": project.domain,
            "nlp_analysis": project.nlp_analysis or {}
        }
    
    def _generate_user_stories_with_rag(self, project_info, rag_db):
        """Generate user stories menggunakan RAG patterns"""
        generator = UserStoryGenerator()
        return generator.generate_comprehensive_user_stories(
            project_info=project_info,
            rag_db=rag_db
        )
    
    def _save_user_stories(self, project, user_stories_data):
        """Save generated user stories"""
        saved_stories = []
        
        for story_data in user_stories_data:
            user_story = UserStory.objects.create(
                project=project,
                story_text=story_data['text'],
                role=story_data['role'],
                action=story_data.get('action', ''),
                benefit=story_data.get('benefit', ''),
                feature=story_data.get('feature', 'General'),
                acceptance_criteria=story_data.get('acceptance_criteria', []),
                priority=story_data.get('priority', 'medium'),
                story_points=story_data.get('story_points', 0),
                generated_by_llm=True,
                iteration=story_data.get('iteration', 1),
                status='draft'
            )
            saved_stories.append(user_story)
        
        return saved_stories
    
    def _generate_wireframes_with_rag(self, project, user_stories, rag_db):
        """Generate wireframes menggunakan RAG UI patterns"""
        generator = WireframeGenerator()
        return generator.generate_html_documentation(
            project=project,
            user_stories=user_stories,
            rag_db=rag_db
        )
    
    def _save_wireframes(self, project, wireframes_data):
        """Save generated wireframes"""
        saved_wireframes = []
        
        for page_name, html_content in wireframes_data.get('role_pages', {}).items():
            wireframe = Wireframe.objects.create(
                project=project,
                page_name=page_name,
                page_type=self._infer_page_type(page_name),
                html_content=html_content,
                generated_with_rag=True,
                version=1
            )
            saved_wireframes.append(wireframe)
        
        return saved_wireframes
    
    def _generate_scenarios_for_story(self, user_story):
        """Generate scenarios untuk user story"""
        generator = ScenarioGenerator()
        return generator.generate_comprehensive_scenarios(user_story=user_story)
    
    def _save_scenarios(self, user_story, scenarios_data):
        """Save generated scenarios"""
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
    
    def _infer_page_type(self, page_name):
        """Infer page type dari page name"""
        page_name_lower = page_name.lower()
        
        if any(word in page_name_lower for word in ['login', 'signin', 'auth']):
            return 'login'
        elif any(word in page_name_lower for word in ['dashboard', 'home', 'main']):
            return 'dashboard'
        elif any(word in page_name_lower for word in ['profile', 'account', 'user']):
            return 'profile'
        elif any(word in page_name_lower for word in ['product', 'catalog', 'item']):
            return 'products'
        elif any(word in page_name_lower for word in ['cart', 'basket']):
            return 'cart'
        elif any(word in page_name_lower for word in ['checkout', 'payment']):
            return 'checkout'
        elif any(word in page_name_lower for word in ['search', 'find']):
            return 'search'
        elif any(word in page_name_lower for word in ['admin', 'management']):
            return 'admin'
        else:
            return 'general'
    
    def _get_stories_by_priority(self, project):
        """Get user stories grouped by priority"""
        from django.db.models import Count
        return project.user_stories.values('priority').annotate(count=Count('priority'))
    
    def _get_scenarios_by_type(self, project):
        """Get scenarios grouped by type"""
        from django.db.models import Count
        return project.scenarios.values('scenario_type').annotate(count=Count('scenario_type'))
    
    def _get_generation_stats(self, project):
        """Get generation session statistics"""
        sessions = project.sessions.all()
        return {
            'total_sessions': sessions.count(),
            'successful_sessions': sessions.filter(status='completed').count(),
            'failed_sessions': sessions.filter(status='failed').count(),
            'total_stories_generated': sum(s.user_stories_generated for s in sessions),
            'total_wireframes_generated': sum(s.wireframes_generated for s in sessions),
            'total_scenarios_generated': sum(s.scenarios_generated for s in sessions)
        }

class UserStoryViewSet(viewsets.ModelViewSet):
    queryset = UserStory.objects.all()
    serializer_class = UserStorySerializer
    
    @action(detail=True, methods=['post'])
    def generate_scenarios(self, request, pk=None):
        """Generate scenarios untuk specific user story"""
        user_story = self.get_object()
        
        try:
            generator = ScenarioGenerator()
            scenarios_data = generator.generate_comprehensive_scenarios(user_story=user_story)
            
            saved_scenarios = self._save_scenarios(user_story, scenarios_data)
            
            return Response({
                'status': 'success',
                'message': f'Generated {len(saved_scenarios)} scenarios',
                'scenarios': ScenarioSerializer(saved_scenarios, many=True).data
            })
            
        except Exception as e:
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def edit_with_ai(self, request, pk=None):
        """AI-assisted editing untuk user story"""
        user_story = self.get_object()
        
        try:
            instructions = request.data.get('instructions', '')
            if not instructions:
                return Response({
                    'status': 'error',
                    'message': 'Editing instructions are required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            from .utils.ai_editor import AIStoryEditor
            editor = AIStoryEditor()
            
            edited_story = editor.ai_assisted_edit(
                user_story=user_story,
                instructions=instructions
            )
            
            # Update user story
            user_story.story_text = edited_story.get('text', user_story.story_text)
            user_story.action = edited_story.get('action', user_story.action)
            user_story.benefit = edited_story.get('benefit', user_story.benefit)
            user_story.feature = edited_story.get('feature', user_story.feature)
            user_story.acceptance_criteria = edited_story.get('acceptance_criteria', user_story.acceptance_criteria)
            user_story.save()
            
            # Create history entry
            ProjectHistory.objects.create(
                project=user_story.project,
                user=user_story.project.user,
                action_type='review_iteration',
                action_details={'method': 'ai_editing', 'instructions': instructions},
                description=f'AI-edited user story: {user_story.role}',
                related_story=user_story
            )
            
            return Response({
                'status': 'success',
                'message': 'User story updated with AI assistance',
                'user_story': UserStorySerializer(user_story).data
            })
            
        except Exception as e:
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _save_scenarios(self, user_story, scenarios_data):
        """Save scenarios untuk user story"""
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

class WireframeViewSet(viewsets.ModelViewSet):
    queryset = Wireframe.objects.all()
    serializer_class = WireframeSerializer
    
    @action(detail=True, methods=['post'])
    def generate_creole(self, request, pk=None):
        """Generate Creole content dari HTML wireframe"""
        wireframe = self.get_object()
        
        try:
            from .utils.creole_converter import convert_html_to_creole
            
            if not wireframe.html_content:
                return Response({
                    'status': 'error',
                    'message': 'No HTML content available for conversion'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            creole_content = convert_html_to_creole(wireframe.html_content)
            wireframe.creole_content = creole_content
            wireframe.save()
            
            return Response({
                'status': 'success',
                'message': 'Creole content generated successfully',
                'creole_content': creole_content
            })
            
        except Exception as e:
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def generate_salt_diagram(self, request, pk=None):
        """Generate Salt UML diagram dari Creole content"""
        wireframe = self.get_object()
        
        try:
            from .utils.salt_generator import generate_salt_wireframe
            
            if not wireframe.creole_content:
                return Response({
                    'status': 'error',
                    'message': 'No Creole content available. Generate Creole first.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            salt_diagram = generate_salt_wireframe(
                wireframe.creole_content, 
                wireframe.page_name
            )
            wireframe.salt_diagram = salt_diagram
            wireframe.save()
            
            return Response({
                'status': 'success',
                'message': 'Salt UML diagram generated successfully',
                'salt_diagram': salt_diagram
            })
            
        except Exception as e:
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ScenarioViewSet(viewsets.ModelViewSet):
    queryset = Scenario.objects.all()
    serializer_class = ScenarioSerializer
    
    @action(detail=True, methods=['post'])
    def validate_structure(self, request, pk=None):
        """Validate Gherkin structure of scenario"""
        scenario = self.get_object()
        
        try:
            from .utils.scenario_generator import ScenarioGenerator
            
            generator = ScenarioGenerator()
            is_valid = generator._check_scenario_structure(scenario.scenario_text)
            
            scenario.has_proper_structure = is_valid
            scenario.save()
            
            return Response({
                'status': 'success',
                'message': 'Scenario structure validated',
                'is_valid': is_valid
            })
            
        except Exception as e:
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class GenerationSessionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = GenerationSession.objects.all()
    serializer_class = GenerationSessionSerializer
    
    @action(detail=True, methods=['get'])
    def session_details(self, request, pk=None):
        """Get detailed session information"""
        session = self.get_object()
        
        details = {
            'session_info': GenerationSessionSerializer(session).data,
            'generated_items': {
                'user_stories': UserStorySerializer(
                    session.project.user_stories.filter(
                        created_at__gte=session.start_time,
                        created_at__lte=session.end_time or timezone.now()
                    ), many=True
                ).data,
                'wireframes': WireframeSerializer(
                    session.project.wireframes.filter(
                        created_at__gte=session.start_time,
                        created_at__lte=session.end_time or timezone.now()
                    ), many=True
                ).data,
                'scenarios': ScenarioSerializer(
                    session.project.scenarios.filter(
                        created_at__gte=session.start_time,
                        created_at__lte=session.end_time or timezone.now()
                    ), many=True
                ).data
            }
        }
        
        return Response({
            'status': 'success',
            'details': details
        })

# Utility API Views
class RAGAPIView(viewsets.ViewSet):
    """API untuk RAG operations"""
    
    @action(detail=False, methods=['post'])
    def search_patterns(self, request):
        """Search similar patterns menggunakan RAG"""
        try:
            query = request.data.get('query', '')
            k = request.data.get('k', 3)
            
            rag_db = ProjectRAGVectorDB()
            patterns = rag_db.retrieve_similar_patterns(query, k)
            
            return Response({
                'status': 'success',
                'query': query,
                'patterns': patterns
            })
            
        except Exception as e:
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def search_ui_patterns(self, request):
        """Search UI patterns menggunakan RAG"""
        try:
            query = request.data.get('query', '')
            k = request.data.get('k', 2)
            
            rag_db = ProjectRAGVectorDB()
            patterns = rag_db.retrieve_ui_patterns(query, k)
            
            return Response({
                'status': 'success',
                'query': query,
                'ui_patterns': patterns
            })
            
        except Exception as e:
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def get_rag_status(self, request):
        """Get RAG database status"""
        try:
            rag_db = ProjectRAGVectorDB()
            collection_count = rag_db.collection.count()
            
            return Response({
                'status': 'success',
                'rag_config': {
                    'model_id': MODEL_ID,
                    'chroma_path': CHROMA_PATH,
                    'collection_count': collection_count,
                    'project_patterns_count': len(rag_db.project_patterns),
                    'ui_patterns_count': len(rag_db.ui_patterns)
                }
            })
            
        except Exception as e:
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def add_custom_pattern(self, request):
        """Add custom pattern ke RAG database"""
        try:
            pattern_data = request.data.get('pattern', {})
            
            if not pattern_data.get('project_type') or not pattern_data.get('description'):
                return Response({
                    'status': 'error',
                    'message': 'Project type and description are required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            rag_db = ProjectRAGVectorDB()
            
            # Add to in-memory patterns
            rag_db.project_patterns.append(pattern_data)
            
            # Add to vector database
            enhanced_doc = f"""
            Project Type: {pattern_data['project_type']}
            Description: {pattern_data['description']}
            Target Users: {pattern_data.get('target_users', 'Various Users')}
            Key Features: {pattern_data.get('key_features', 'Standard Features')}
            """
            
            rag_db.collection.add(
                documents=[enhanced_doc],
                metadatas=[pattern_data],
                ids=[f"custom_pattern_{len(rag_db.project_patterns)}"]
            )
            
            return Response({
                'status': 'success',
                'message': 'Custom pattern added successfully',
                'pattern_id': f"custom_pattern_{len(rag_db.project_patterns)}"
            })
            
        except Exception as e:
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Health Check dan System Status
class SystemAPIView(viewsets.ViewSet):
    """System health check dan status"""
    
    @action(detail=False, methods=['get'])
    def health(self, request):
        """System health check"""
        try:
            # Check database connection
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            
            # Check RAG system
            rag_db = ProjectRAGVectorDB()
            rag_status = rag_db.collection.count() > 0
            
            # Check Replicate API (basic check)
            api_status = bool(REPLICATE_API_TOKEN and REPLICATE_API_TOKEN != 'your_replicate_api_token_here')
            
            return Response({
                'status': 'healthy',
                'timestamp': timezone.now(),
                'components': {
                    'database': 'connected',
                    'rag_system': 'active' if rag_status else 'inactive',
                    'llm_api': 'configured' if api_status else 'not_configured'
                },
                'statistics': {
                    'total_projects': Project.objects.count(),
                    'total_user_stories': UserStory.objects.count(),
                    'total_wireframes': Wireframe.objects.count(),
                    'total_scenarios': Scenario.objects.count()
                }
            })
            
        except Exception as e:
            return Response({
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': timezone.now()
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    
    @action(detail=False, methods=['get'])
    def config(self, request):
        """Get system configuration (non-sensitive)"""
        return Response({
            'system_config': {
                'model_id': MODEL_ID,
                'rag_enabled': True,
                'chroma_path': CHROMA_PATH,
                'max_iterations': 3,
                'api_configured': REPLICATE_API_TOKEN != 'your_replicate_api_token_here'
            }
        })