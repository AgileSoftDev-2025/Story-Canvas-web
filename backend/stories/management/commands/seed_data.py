import json
from django.core.management.base import BaseCommand
from django.utils import timezone
from stories.models import CustomUser, Project, UserStory, Wireframe, Scenario, ProjectHistory, Export, GenerationSession

class Command(BaseCommand):
    help = 'Seed the database with comprehensive sample data for Story Canvas'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing data before seeding',
        )
        parser.add_argument(
            '--skip-users',
            action='store_true',
            help='Skip creating demo users',
        )
    
    def handle(self, *args, **options):
        self.stdout.write('🌱 Starting database seeding...')
        
        if options['clear']:
            self.clear_existing_data()
        
        # Create sample users
        if not options['skip_users']:
            demo_users = self.create_demo_users()
            main_user = demo_users[0]  # Product owner as main user
        else:
            # Use existing user or create one
            main_user = CustomUser.objects.first()
            if not main_user:
                main_user = CustomUser.objects.create_user(
                    username='admin',
                    email='admin@storycanvas.com',
                    password='admin123'
                )
                self.stdout.write('👑 Created admin user')
        
        # Create sample projects
        projects = self.create_sample_projects(main_user)
        
        # Create sample data for each project
        for project in projects:
            self.create_project_data(project, main_user)
        
        self.stdout.write(
            self.style.SUCCESS('🎉 Database seeding completed successfully!')
        )
        self.stdout.write(
            self.style.SUCCESS('📊 Created: 3 projects, multiple user stories, wireframes, scenarios, and exports')
        )
    
    def clear_existing_data(self):
        """Clear all existing data"""
        self.stdout.write('🗑️ Clearing existing data...')
        Export.objects.all().delete()
        Scenario.objects.all().delete()
        Wireframe.objects.all().delete()
        UserStory.objects.all().delete()
        GenerationSession.objects.all().delete()
        ProjectHistory.objects.all().delete()
        Project.objects.all().delete()
        CustomUser.objects.filter(username__startswith='demo_').delete()
        self.stdout.write('✅ Existing data cleared')
    
    def create_demo_users(self):
        """Create demo user accounts"""
        users_data = [
            {
                'username': 'demo_product_owner',
                'email': 'product_owner@storycanvas.com',
                'password': 'demo123',
            },
            {
                'username': 'demo_developer', 
                'email': 'developer@storycanvas.com',
                'password': 'demo123',
            },
            {
                'username': 'demo_designer',
                'email': 'designer@storycanvas.com',
                'password': 'demo123',
            }
        ]
        
        created_users = []
        for user_data in users_data:
            # Check if user exists first
            if CustomUser.objects.filter(username=user_data['username']).exists():
                user = CustomUser.objects.get(username=user_data['username'])
                self.stdout.write(f"⚠️ User already exists: {user.username}")
            else:
                # Create user using the manager
                user = CustomUser.objects.create_user(
                    username=user_data['username'],
                    email=user_data['email'],
                    password=user_data['password'],
                )
                self.stdout.write(f"✅ Created user: {user.username}")
            created_users.append(user)
        
        return created_users
    
    def create_sample_projects(self, user):
        """Create sample projects with comprehensive data"""
        projects_data = [
            {
                'title': 'E-commerce Platform',
                'objective': 'Create a seamless shopping experience for customers and efficient management for sellers',
                'scope': 'Web and mobile application with admin dashboard. Includes product catalog, shopping cart, payment processing, and order management.',
                'flow': 'User Registration → Browse Products → Add to Cart → Checkout → Payment → Order Tracking → Delivery',
                'additional_info': 'Focus on mobile-first design and personalized recommendations',
                'users_data': [
                    {'role': 'Customer', 'description': 'End user who purchases products'},
                    {'role': 'Seller', 'description': 'User who manages products and orders'},
                    {'role': 'Admin', 'description': 'System administrator with full access'}
                ],
                'features_data': [
                    {'name': 'Product Catalog', 'description': 'Browse and search products'},
                    {'name': 'Shopping Cart', 'description': 'Add and manage items for purchase'},
                    {'name': 'Payment Processing', 'description': 'Secure payment transactions'}
                ],
                'domain': 'E-commerce',
                'language': 'en',
                'nlp_analysis': {
                    'domain': 'E-commerce',
                    'entities': ['products', 'shopping', 'payments', 'orders'],
                    'key_nouns': ['customer', 'product', 'cart', 'order'],
                    'key_verbs': ['browse', 'purchase', 'manage', 'track'],
                    'potential_users': ['Customer', 'Seller', 'Admin'],
                    'potential_features': ['product search', 'shopping cart', 'payment system']
                },
                'status': 'in_progress'
            },
            {
                'title': 'Healthcare Management System',
                'objective': 'Digital platform for patient management, appointment scheduling, and medical records',
                'scope': 'Web application for patients, doctors, and administrative staff. Includes appointment booking, medical records, prescription management.',
                'flow': 'Patient Registration → Book Appointment → Consultation → Prescription → Follow-up',
                'additional_info': 'HIPAA compliant with focus on data security and privacy',
                'users_data': [
                    {'role': 'Patient', 'description': 'Individual receiving medical care'},
                    {'role': 'Doctor', 'description': 'Medical professional providing care'},
                    {'role': 'Nurse', 'description': 'Medical staff assisting doctors'}
                ],
                'features_data': [
                    {'name': 'Appointment Scheduling', 'description': 'Book and manage medical appointments'},
                    {'name': 'Medical Records', 'description': 'Store and access patient health information'},
                    {'name': 'Prescription Management', 'description': 'Create and track medication prescriptions'}
                ],
                'domain': 'Healthcare',
                'language': 'en',
                'nlp_analysis': {
                    'domain': 'Healthcare',
                    'entities': ['patients', 'doctors', 'appointments', 'medical records'],
                    'key_nouns': ['patient', 'doctor', 'appointment', 'prescription'],
                    'key_verbs': ['schedule', 'consult', 'prescribe', 'manage'],
                    'potential_users': ['Patient', 'Doctor', 'Nurse', 'Admin'],
                    'potential_features': ['appointment system', 'medical records', 'prescription tracker']
                },
                'status': 'in_progress'
            },
            {
                'title': 'Online Learning Platform',
                'objective': 'Interactive platform for course delivery, student engagement, and progress tracking',
                'scope': 'Web and mobile application with course management, video streaming, assignments, and grading system.',
                'flow': 'Student Registration → Enroll in Course → Watch Videos → Complete Assignments → Receive Grades → Get Certificate',
                'additional_info': 'Focus on interactive learning and gamification elements',
                'users_data': [
                    {'role': 'Student', 'description': 'Learner taking courses'},
                    {'role': 'Teacher', 'description': 'Educator creating and delivering content'},
                    {'role': 'Administrator', 'description': 'Platform manager and support'}
                ],
                'features_data': [
                    {'name': 'Course Management', 'description': 'Create and organize learning materials'},
                    {'name': 'Video Streaming', 'description': 'Deliver video content efficiently'},
                    {'name': 'Assignment System', 'description': 'Submit and grade student work'}
                ],
                'domain': 'Education',
                'language': 'en',
                'nlp_analysis': {
                    'domain': 'Education',
                    'entities': ['courses', 'students', 'teachers', 'assignments'],
                    'key_nouns': ['student', 'teacher', 'course', 'assignment'],
                    'key_verbs': ['learn', 'teach', 'submit', 'grade'],
                    'potential_users': ['Student', 'Teacher', 'Administrator'],
                    'potential_features': ['course catalog', 'video player', 'gradebook']
                },
                'status': 'draft'
            }
        ]
        
        created_projects = []
        for project_data in projects_data:
            if Project.objects.filter(title=project_data['title'], user=user).exists():
                project = Project.objects.get(title=project_data['title'], user=user)
                self.stdout.write(f"⚠️ Project already exists: {project.title}")
            else:
                project = Project.objects.create(
                    user=user,
                    **project_data
                )
                self.stdout.write(f"✅ Created project: {project.title} ({project.domain})")
            created_projects.append(project)
        
        return created_projects
    
    def create_project_data(self, project, user):
        """Create comprehensive data for a project"""
        self.stdout.write(f"\n📦 Setting up data for: {project.title}")
        
        # Create generation session
        session = GenerationSession.objects.create(
            project=project,
            user=user,
            llm_model_used='ibm-granite/granite-3.3-8b-instruct',
            user_stories_generated=0,
            wireframes_generated=0,
            scenarios_generated=0,
            total_iterations=1,
            status='completed'
        )
        
        # Create user stories
        user_stories = self.create_user_stories(project)
        session.user_stories_generated = len(user_stories)
        
        # Create wireframes
        wireframes = self.create_wireframes(project)
        session.wireframes_generated = len(wireframes)
        
        # Create scenarios
        scenarios = self.create_scenarios(project, user_stories)
        session.scenarios_generated = len(scenarios)
        
        session.save()
        
        # Create project history
        self.create_project_history(project, user, session, user_stories, wireframes, scenarios)
        
        # Create exports
        self.create_exports(project, user, session)
        
        self.stdout.write(f"✅ Completed setup for: {project.title}")
    
    def create_user_stories(self, project):
        """Create user stories based on project domain"""
        if project.domain == 'E-commerce':
            stories_data = self.get_ecommerce_stories()
        elif project.domain == 'Healthcare':
            stories_data = self.get_healthcare_stories()
        else:
            stories_data = self.get_education_stories()
        
        created_stories = []
        for story_data in stories_data:
            story = UserStory.objects.create(
                project=project,
                **story_data
            )
            created_stories.append(story)
            self.stdout.write(f"   📖 {story.role}: {story.action[:30]}...")
        
        return created_stories
        
    def get_ecommerce_stories(self):
        """E-commerce specific user stories"""
        return [
            {
                'story_text': 'As a customer, I want to browse products by category so that I can find what I need quickly',
                'role': 'Customer',
                'action': 'browse products by category',
                'benefit': 'find what I need quickly',
                'feature': 'Product Browsing',
                'priority': 'high',
                'acceptance_criteria': [
                    'Product categories are clearly displayed on the homepage',
                    'Clicking a category shows relevant products',
                    'Categories have clear names and images',
                    'Breadcrumb navigation shows current category'
                ],
                'story_points': 5,
                'status': 'approved',
                'generated_by_llm': True,
                'iteration': 1
            },
            {
                'story_text': 'As a customer, I want to search for specific products so that I can find exactly what I want',
                'role': 'Customer',
                'action': 'search for specific products',
                'benefit': 'find exactly what I want',
                'feature': 'Product Search',
                'priority': 'high',
                'acceptance_criteria': [
                    'Search bar is visible on all pages',
                    'Search returns relevant results quickly',
                    'Search suggestions appear as I type',
                    'No results message is helpful'
                ],
                'story_points': 3,
                'status': 'approved',
                'generated_by_llm': True,
                'iteration': 1
            },
            {
                'story_text': 'As a customer, I want to add items to my shopping cart so that I can purchase them later',
                'role': 'Customer',
                'action': 'add items to shopping cart',
                'benefit': 'purchase them later',
                'feature': 'Shopping Cart',
                'priority': 'high',
                'acceptance_criteria': [
                    'Add to cart button is visible on product pages',
                    'Cart icon shows current item count',
                    'Items persist in cart between sessions',
                    'Easy to view and modify cart contents'
                ],
                'story_points': 3,
                'status': 'approved',
                'generated_by_llm': True,
                'iteration': 1
            },
            {
                'story_text': 'As a seller, I want to manage my product inventory so that I can keep stock levels accurate',
                'role': 'Seller',
                'action': 'manage product inventory',
                'benefit': 'keep stock levels accurate',
                'feature': 'Inventory Management',
                'priority': 'medium',
                'acceptance_criteria': [
                    'Can add new products with images and descriptions',
                    'Can update existing product information',
                    'Can set and modify stock quantities',
                    'Receive low stock alerts automatically'
                ],
                'story_points': 8,
                'status': 'reviewed',
                'generated_by_llm': True,
                'iteration': 1
            }
        ]
    
    def get_healthcare_stories(self):
        """Healthcare specific user stories"""
        return [
            {
                'story_text': 'As a patient, I want to book appointments online so that I can avoid phone calls',
                'role': 'Patient',
                'action': 'book appointments online',
                'benefit': 'avoid phone calls',
                'feature': 'Appointment Booking',
                'priority': 'high',
                'acceptance_criteria': [
                    'See available time slots for my doctor',
                    'Select preferred appointment date and time',
                    'Receive confirmation email/SMS',
                    'Can cancel or reschedule appointments'
                ],
                'story_points': 5,
                'status': 'approved',
                'generated_by_llm': True,
                'iteration': 1
            },
            {
                'story_text': 'As a doctor, I want to view patient medical history so that I can provide better care',
                'role': 'Doctor',
                'action': 'view patient medical history',
                'benefit': 'provide better care',
                'feature': 'Medical Records',
                'priority': 'high',
                'acceptance_criteria': [
                    'Access complete patient medical history',
                    'View past prescriptions and treatments',
                    'See lab results and test reports',
                    'Medical data is secure and private'
                ],
                'story_points': 8,
                'status': 'approved',
                'generated_by_llm': True,
                'iteration': 1
            },
            {
                'story_text': 'As a nurse, I want to update patient vital signs so that doctors have current information',
                'role': 'Nurse',
                'action': 'update patient vital signs',
                'benefit': 'doctors have current information',
                'feature': 'Patient Monitoring',
                'priority': 'medium',
                'acceptance_criteria': [
                    'Can enter blood pressure, temperature, and pulse',
                    'Vital signs are timestamped automatically',
                    'Abnormal values trigger alerts',
                    'Historical data is easily accessible'
                ],
                'story_points': 5,
                'status': 'reviewed',
                'generated_by_llm': True,
                'iteration': 1
            }
        ]
    
    def get_education_stories(self):
        """Education specific user stories"""
        return [
            {
                'story_text': 'As a student, I want to access course materials online so that I can learn at my own pace',
                'role': 'Student',
                'action': 'access course materials online',
                'benefit': 'learn at my own pace',
                'feature': 'Course Access',
                'priority': 'high',
                'acceptance_criteria': [
                    'Course materials are organized by modules',
                    'Videos and documents load quickly',
                    'Progress tracking shows completed sections',
                    'Materials are accessible on mobile devices'
                ],
                'story_points': 5,
                'status': 'approved',
                'generated_by_llm': True,
                'iteration': 1
            },
            {
                'story_text': 'As a teacher, I want to grade student assignments so that I can provide feedback',
                'role': 'Teacher',
                'action': 'grade student assignments',
                'benefit': 'provide feedback',
                'feature': 'Assignment Grading',
                'priority': 'medium',
                'acceptance_criteria': [
                    'View submitted assignments in one place',
                    'Add grades and comments easily',
                    'Students receive grade notifications',
                    'Gradebook updates automatically'
                ],
                'story_points': 8,
                'status': 'reviewed',
                'generated_by_llm': True,
                'iteration': 1
            },
            {
                'story_text': 'As a student, I want to take online quizzes so that I can test my knowledge',
                'role': 'Student',
                'action': 'take online quizzes',
                'benefit': 'test my knowledge',
                'feature': 'Assessment System',
                'priority': 'medium',
                'acceptance_criteria': [
                    'Quizzes have clear instructions and time limits',
                    'Multiple question types are supported',
                    'Immediate feedback on answers',
                    'Results are saved to progress tracking'
                ],
                'story_points': 5,
                'status': 'approved',
                'generated_by_llm': True,
                'iteration': 1
            }
        ]
    
    def create_wireframes(self, project):
        """Create comprehensive wireframes for a project"""
        if project.domain == 'E-commerce':
            wireframes_data = self.get_ecommerce_wireframes()
        elif project.domain == 'Healthcare':
            wireframes_data = self.get_healthcare_wireframes()
        else:
            wireframes_data = self.get_education_wireframes()
        
        created_wireframes = []
        for wireframe_data in wireframes_data:
            wireframe = Wireframe.objects.create(
                project=project,
                **wireframe_data
            )
            created_wireframes.append(wireframe)
            self.stdout.write(f"   🎨 {wireframe.page_name} ({wireframe.page_type})")
        
        return created_wireframes
    
    def get_ecommerce_wireframes(self):
        return [
            {
                'page_name': 'Homepage',
                'page_type': 'dashboard',
                'description': 'Main landing page with featured products and categories',
                'html_content': '<div class="homepage"><header><nav><div class="logo">ShopEasy</div><div class="search-bar"><input type="text" placeholder="Search products..."><button>Search</button></div><div class="user-menu">Cart (3) | Login</div></nav><section class="hero"><h1>Welcome to ShopEasy</h1><p>Discover amazing products</p></section><section class="categories"><h2>Shop by Category</h2><div class="category-grid">...</div></section></div>',
                'creole_content': '= ShopEasy Homepage\n\n== Header\n* Logo: "ShopEasy"\n* Search: [Search products...] [Search]\n* User: Cart (3) | Login\n\n== Hero Section\n**Welcome to ShopEasy**\nDiscover amazing products\n\n== Categories\n**Shop by Category**\n* Electronics\n* Clothing\n* Home & Garden\n* Sports',
                'salt_diagram': '@startsalt\n{+\n{^ "ShopEasy - Homepage"\n[Logo] | [Search products...] [Search] | [Cart (3)] [Login]\n---\n"Welcome to ShopEasy"\n"Discover amazing products"\n---\n{#\nElectronics | Clothing | Home & Garden | Sports\n}\n}\n@endsalt',
                'preview_url': 'http://localhost:8000/media/wireframes/homepage.png',
                'generated_with_rag': True,
                'wireframe_type': 'desktop',
                'version': 1
            },
            {
                'page_name': 'Product Listing',
                'page_type': 'products',
                'description': 'Product catalog with filtering and sorting options',
                'html_content': '<div class="product-listing"><div class="filters"><h3>Filters</h3><div class="price-range">Price Range</div><div class="categories">Categories</div></div><div class="products-grid"><div class="product-card"><img src="product1.jpg"><h3>Wireless Headphones</h3><p>$99.99</p><button>Add to Cart</button></div></div></div>',
                'creole_content': '= Product Listing\n\n== Filters\n* Price Range: $0 - $200\n* Categories: Electronics > Audio > Headphones\n* Brand: Sony, Bose, Apple\n\n== Products\n* **Wireless Headphones** - $99.99 [Add to Cart]\n* **Smart Watch** - $199.99 [Add to Cart]\n* **Bluetooth Speaker** - $49.99 [Add to Cart]',
                'salt_diagram': '@startsalt\n{+\n{^ "Product Listing"\n{^ "Filters"\nPrice: [$0 - $200]\nCategory: [Electronics > Audio]\nBrand: [Sony] [Bose] [Apple]\n}\n|\n{^ "Products"\n{#\nWireless Headphones | $99.99 | [Add to Cart]\nSmart Watch | $199.99 | [Add to Cart]\nBluetooth Speaker | $49.99 | [Add to Cart]\n}\n}\n}\n@endsalt',
                'preview_url': 'http://localhost:8000/media/wireframes/product-listing.png',
                'generated_with_rag': True,
                'wireframe_type': 'desktop',
                'version': 1
            },
            {
                'page_name': 'Shopping Cart',
                'page_type': 'cart',
                'description': 'Shopping cart page showing selected items and checkout options',
                'html_content': '<div class="shopping-cart"><h1>Shopping Cart</h1><div class="cart-items"><div class="cart-item"><img src="product1.jpg"><div class="item-details"><h3>Wireless Headphones</h3><p>$99.99</p><div class="quantity">Qty: 1</div></div></div></div><div class="cart-summary"><h3>Order Summary</h3><p>Subtotal: $99.99</p><button>Proceed to Checkout</button></div></div>',
                'preview_url': 'http://localhost:8000/media/wireframes/shopping-cart.png',
                'generated_with_rag': True,
                'wireframe_type': 'desktop',
                'version': 1
            }
        ]
    
    def get_healthcare_wireframes(self):
        return [
            {
                'page_name': 'Patient Dashboard',
                'page_type': 'dashboard',
                'description': 'Main dashboard for patients to manage appointments and health records',
                'html_content': '<div class="patient-dashboard"><div class="welcome">Welcome, John Doe</div><div class="quick-actions"><button>Book Appointment</button><button>View Records</button></div><div class="upcoming-appointments"><h3>Upcoming Appointments</h3><div class="appointment-card"><p>Dr. Smith - Cardiology</p><p>Tomorrow, 2:00 PM</p></div></div></div>',
                'creole_content': '= Patient Dashboard\n\n== Welcome\nWelcome, John Doe\n\n== Quick Actions\n* [Book Appointment]\n* [View Records]\n\n== Upcoming Appointments\n**Tomorrow, 2:00 PM**\nDr. Smith - Cardiology\n[View Details] [Reschedule]',
                'preview_url': 'http://localhost:8000/media/wireframes/patient-dashboard.png',
                'generated_with_rag': True,
                'wireframe_type': 'desktop',
                'version': 1
            },
            {
                'page_name': 'Appointment Booking',
                'page_type': 'general',
                'description': 'Page for scheduling new medical appointments',
                'html_content': '<div class="appointment-booking"><h1>Book Appointment</h1><div class="doctor-selection"><select><option>Select Doctor</option></select></div><div class="calendar-view"><h3>Available Time Slots</h3></div><button>Confirm Appointment</button></div>',
                'preview_url': 'http://localhost:8000/media/wireframes/appointment-booking.png',
                'generated_with_rag': True,
                'wireframe_type': 'desktop',
                'version': 1
            }
        ]
    
    def get_education_wireframes(self):
        return [
            {
                'page_name': 'Student Portal',
                'page_type': 'dashboard',
                'description': 'Main portal for students to access courses and assignments',
                'html_content': '<div class="student-portal"><h1>My Courses</h1><div class="course-list"><div class="course-card"><h3>Introduction to Programming</h3><p>Progress: 75%</p><button>Continue</button></div></div><div class="upcoming-deadlines"><h3>Upcoming Deadlines</h3></div></div>',
                'creole_content': '= Student Portal\n\n== My Courses\n**Introduction to Programming**\nProgress: 75% [Continue]\n\n**Web Development Basics**\nProgress: 30% [Continue]\n\n== Upcoming Deadlines\n* Assignment 3: Due in 2 days\n* Quiz 1: Due in 5 days',
                'preview_url': 'http://localhost:8000/media/wireframes/student-portal.png',
                'generated_with_rag': True,
                'wireframe_type': 'desktop',
                'version': 1
            },
            {
                'page_name': 'Course Player',
                'page_type': 'general',
                'description': 'Video player and course content interface',
                'html_content': '<div class="course-player"><div class="video-player"><video controls></video></div><div class="course-content"><h2>Lesson 1: Introduction</h2><div class="lesson-materials">...</div></div></div>',
                'preview_url': 'http://localhost:8000/media/wireframes/course-player.png',
                'generated_with_rag': True,
                'wireframe_type': 'desktop',
                'version': 1
            }
        ]
    
    def create_scenarios(self, project, user_stories):
        """Create comprehensive scenarios for user stories"""
        created_scenarios = []
        
        for user_story in user_stories:
            scenarios_data = self.get_scenarios_for_story(user_story)
            
            for scenario_data in scenarios_data:
                scenario = Scenario.objects.create(
                    project=project,
                    user_story=user_story,
                    **scenario_data
                )
                created_scenarios.append(scenario)
                self.stdout.write(f"   🧪 {scenario.scenario_type}: {scenario.title}")
        
        return created_scenarios
    
    def get_scenarios_for_story(self, user_story):
        """Get different scenario types for a user story"""
        return [
            {
                'scenario_text': f'Scenario: Happy Path - Successful {user_story.action}\n  Given I am a {user_story.role}\n  And I want to {user_story.action}\n  When I follow the correct process\n  Then I should be able to {user_story.benefit}\n  And receive confirmation of success',
                'scenario_type': 'happy_path',
                'title': f'Successful {user_story.action}',
                'detected_domain': user_story.project.domain,
                'has_proper_structure': True,
                'gherkin_steps': [
                    {'type': 'Given', 'text': f'I am a {user_story.role}'},
                    {'type': 'And', 'text': f'I want to {user_story.action}'},
                    {'type': 'When', 'text': 'I follow the correct process'},
                    {'type': 'Then', 'text': f'I should be able to {user_story.benefit}'},
                    {'type': 'And', 'text': 'receive confirmation of success'}
                ],
                'enhanced_with_llm': True,
                'status': 'approved'
            },
            {
                'scenario_text': f'Scenario: Exception Path - {user_story.action} with invalid data\n  Given I am a {user_story.role}\n  When I attempt to {user_story.action} with incorrect information\n  Then the system should display appropriate error messages\n  And prevent me from proceeding until corrections are made',
                'scenario_type': 'exception_path',
                'title': f'{user_story.action} with invalid data',
                'detected_domain': user_story.project.domain,
                'has_proper_structure': True,
                'gherkin_steps': [
                    {'type': 'Given', 'text': f'I am a {user_story.role}'},
                    {'type': 'When', 'text': f'I attempt to {user_story.action} with incorrect information'},
                    {'type': 'Then', 'text': 'the system should display appropriate error messages'},
                    {'type': 'And', 'text': 'prevent me from proceeding until corrections are made'}
                ],
                'enhanced_with_llm': True,
                'status': 'approved'
            }
        ]
    
    def create_project_history(self, project, user, session, user_stories, wireframes, scenarios):
        """Create comprehensive project history"""
        history_entries = [
            {
                'user': user,
                'generation_session': session,
                'action_type': 'project_created',
                'action_details': {'action': 'project_creation', 'method': 'manual'},
                'description': 'Project created and initial requirements defined'
            },
            {
                'user': user,
                'generation_session': session,
                'action_type': 'stories_generated',
                'action_details': {'count': len(user_stories), 'method': 'ai_generation'},
                'description': 'AI-generated user stories based on project requirements',
                'related_story': user_stories[0] if user_stories else None
            },
            {
                'user': user,
                'generation_session': session,
                'action_type': 'wireframes_generated',
                'action_details': {'count': len(wireframes), 'method': 'ai_generation'},
                'description': 'Wireframes generated using RAG patterns and AI',
                'related_wireframe': wireframes[0] if wireframes else None
            },
            {
                'user': user,
                'generation_session': session,
                'action_type': 'scenarios_generated',
                'action_details': {'count': len(scenarios), 'method': 'ai_generation'},
                'description': 'Test scenarios generated for user stories',
                'related_scenario': scenarios[0] if scenarios else None
            }
        ]
        
        for history_data in history_entries:
            ProjectHistory.objects.create(
                project=project,
                **history_data
            )
        
        self.stdout.write(f"   📝 Created project history")
    
    def create_exports(self, project, user, session):
        """Create sample export records"""
        exports_data = [
            {
                'user': user,
                'generation_session': session,
                'export_format': 'html',
                'file_path': f'/exports/{project.project_id}/documentation.html',
                'file_url': f'http://localhost:8000/media/exports/{project.project_id}/documentation.html',
                'file_size': 2048000,
                'include_stories': True,
                'include_wireframes': True,
                'include_scenarios': True,
                'export_config': {'theme': 'modern', 'sections': ['stories', 'wireframes', 'scenarios']},
                'status': 'completed'
            },
            {
                'user': user,
                'generation_session': session,
                'export_format': 'json',
                'file_path': f'/exports/{project.project_id}/project-data.json',
                'file_url': f'http://localhost:8000/media/exports/{project.project_id}/project-data.json',
                'file_size': 512000,
                'include_stories': True,
                'include_wireframes': False,
                'include_scenarios': True,
                'export_config': {'format': 'structured', 'include_metadata': True},
                'status': 'completed'
            }
        ]
        
        for export_data in exports_data:
            Export.objects.create(
                project=project,
                **export_data
            )
        
        self.stdout.write(f"   📤 Created export records")