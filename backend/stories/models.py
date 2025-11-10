import uuid
import json
from django.db import models
from django.contrib.auth.hashers import make_password, check_password
from django.core.validators import validate_email
from django.core.exceptions import ValidationError

def generate_short_uuid():
    return str(uuid.uuid4())[:50]

class CustomUserManager(models.Manager):
    def create_user(self, username, email, password=None, **extra_fields):
        """
        Create and return a regular user with username, email and password.
        """
        if not username:
            raise ValueError('The Username field must be set')
        if not email:
            raise ValueError('The Email field must be set')
        
        # Validate email format
        try:
            validate_email(email)
        except ValidationError:
            raise ValueError('Invalid email format')
        
        email = self.normalize_email(email)
        user = self.model(username=username, email=email, **extra_fields)
        
        # Set password directly
        if password:
            user.set_password(password)
        
        user.save(using=self._db)
        return user
    
    def normalize_email(self, email):
        """
        Normalize the email address by lowercasing the domain part of it.
        """
        email = email or ''
        try:
            email_name, domain_part = email.strip().rsplit('@', 1)
        except ValueError:
            pass
        else:
            email = email_name + '@' + domain_part.lower()
        return email

class CustomUser(models.Model):
    """
    Completely custom user model without Django auth dependencies.
    """
    username = models.CharField(max_length=100, unique=True)
    email = models.CharField(max_length=255, unique=True)
    password = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(auto_now=True)
    
    is_active = models.BooleanField(default=True)
    
    objects = CustomUserManager()
    
    # REQUIRED FIELDS - Django requires these for custom user models
    # These don't create superusers, they just tell Django how your auth works
    USERNAME_FIELD = 'username'  # This field is used for login
    REQUIRED_FIELDS = ['email']  # Fields required when creating users (besides username/password)
    
    class Meta:
        db_table = 'custom_user'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        indexes = [
            models.Index(fields=['username']),
            models.Index(fields=['email']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return self.username
    
    def set_password(self, raw_password):
        """Set password hash"""
        self.password = make_password(raw_password)
    
    def check_password(self, raw_password):
        """Check password using Django's built-in method"""
        return check_password(raw_password, self.password)
    
    @property
    def is_authenticated(self):
        return True
    
    @property
    def is_anonymous(self):
        return False
    
    def has_perm(self, perm, obj=None):
        return True
    
    def has_module_perms(self, app_label):
        return True

# The rest of your models remain exactly the same...
class Project(models.Model):
    PROJECT_STATUS = [
        ('draft', 'Draft'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('archived', 'Archived'),
    ]
    
    project_id = models.CharField(max_length=50, unique=True, default=generate_short_uuid, primary_key=True)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='projects')
    
    # Core project info (from collect_project_info_form)
    title = models.CharField(max_length=255)
    objective = models.TextField(blank=True, null=True)
    scope = models.TextField(blank=True, null=True)
    flow = models.TextField(blank=True, null=True)
    additional_info = models.TextField(blank=True, null=True)
    
    # From project analysis (analyze_project_description)
    domain = models.CharField(max_length=100, blank=True, null=True)
    language = models.CharField(max_length=10, blank=True, null=True)
    nlp_analysis = models.JSONField(default=dict, blank=True)
    
    # JSON data storage
    users_data = models.JSONField(default=list, blank=True)
    features_data = models.JSONField(default=list, blank=True)
    
    status = models.CharField(max_length=20, choices=PROJECT_STATUS, default='draft')
    created_date = models.DateTimeField(auto_now_add=True)
    last_modified = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'projects'
        ordering = ['-created_date']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['created_date']),
        ]
    
    def __str__(self):
        return self.title
    
    @property
    def user_stories_count(self):
        return self.user_stories.count()
    
    @property
    def wireframes_count(self):
        return self.wireframes.count()
    
    @property
    def scenarios_count(self):
        return self.scenarios.count()

class UserStory(models.Model):
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]
    
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('reviewed', 'Reviewed'),
        ('approved', 'Approved'),
        ('implemented', 'Implemented'),
    ]
    
    story_id = models.CharField(max_length=50, unique=True, default=generate_short_uuid, primary_key=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='user_stories')
    
    story_text = models.TextField()
    role = models.CharField(max_length=100)
    action = models.TextField()
    benefit = models.TextField()
    feature = models.CharField(max_length=100, blank=True, null=True)
    
    acceptance_criteria = models.JSONField(default=list, blank=True)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    story_points = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    
    generated_by_llm = models.BooleanField(default=True)
    iteration = models.IntegerField(default=1)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'user_stories'
        ordering = ['priority', 'created_at']
        indexes = [
            models.Index(fields=['project', 'status']),
            models.Index(fields=['project', 'priority']),
            models.Index(fields=['feature']),
        ]
    
    def __str__(self):
        return f"{self.role}: {self.action[:50]}..."
    
    @property
    def scenarios_count(self):
        return self.scenarios.count()

class Wireframe(models.Model):
    WIREFRAME_TYPES = [
        ('desktop', 'Desktop'),
        ('mobile', 'Mobile'),
        ('tablet', 'Tablet'),
    ]
    
    PAGE_TYPES = [
        ('login', 'Login Page'),
        ('dashboard', 'Dashboard'),
        ('profile', 'User Profile'),
        ('products', 'Product Listing'),
        ('cart', 'Shopping Cart'),
        ('checkout', 'Checkout Page'),
        ('search', 'Search Results'),
        ('admin', 'Admin Panel'),
        ('general', 'General Page'),
    ]
    
    wireframe_id = models.CharField(max_length=50, unique=True, default=generate_short_uuid, primary_key=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='wireframes')
    
    page_name = models.CharField(max_length=255)
    page_type = models.CharField(max_length=100, choices=PAGE_TYPES, default='general')
    description = models.TextField(blank=True, null=True)
    
    html_content = models.TextField(blank=True, null=True)
    creole_content = models.TextField(blank=True, null=True)
    salt_diagram = models.TextField(blank=True, null=True)
    
    generated_with_rag = models.BooleanField(default=True)
    wireframe_type = models.CharField(max_length=20, choices=WIREFRAME_TYPES, default='desktop')
    version = models.IntegerField(default=1)
    
    preview_url = models.URLField(max_length=500, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'wireframes'
        ordering = ['page_name', '-version']
        unique_together = ['project', 'page_name', 'version']
        indexes = [
            models.Index(fields=['project', 'page_type']),
        ]
    
    def __str__(self):
        return f"{self.page_name} - {self.project.title}"

class Scenario(models.Model):
    SCENARIO_TYPES = [
        ('happy_path', 'Happy Path'),
        ('alternate_path', 'Alternate Path'),
        ('exception_path', 'Exception Path'),
        ('boundary_case', 'Boundary Case'),
    ]
    
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('reviewed', 'Reviewed'),
        ('approved', 'Approved'),
        ('tested', 'Tested'),
    ]
    
    scenario_id = models.CharField(max_length=50, unique=True, default=generate_short_uuid, primary_key=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='scenarios')
    user_story = models.ForeignKey(UserStory, on_delete=models.CASCADE, related_name='scenarios', blank=True, null=True)
    
    scenario_text = models.TextField()
    scenario_type = models.CharField(max_length=20, choices=SCENARIO_TYPES, default='happy_path')
    title = models.CharField(max_length=200, blank=True, null=True)
    
    detected_domain = models.CharField(max_length=100, blank=True, null=True)
    has_proper_structure = models.BooleanField(default=True)
    
    gherkin_steps = models.JSONField(default=list, blank=True)
    
    enhanced_with_llm = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'scenarios'
        ordering = ['user_story', 'scenario_type', 'created_at']
        indexes = [
            models.Index(fields=['user_story', 'scenario_type']),
            models.Index(fields=['project', 'status']),
        ]
    
    def __str__(self):
        story_ref = self.user_story.role if self.user_story else 'Project'
        return f"{self.scenario_type}: {self.title or self.scenario_text[:50]}... ({story_ref})"

class GenerationSession(models.Model):
    SESSION_STATUS = [
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    session_id = models.CharField(max_length=50, unique=True, default=generate_short_uuid, primary_key=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='sessions')
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='generation_sessions')
    
    llm_model_used = models.CharField(max_length=100, default='ibm-granite/granite-3.3-8b-instruct')
    
    user_stories_generated = models.IntegerField(default=0)
    wireframes_generated = models.IntegerField(default=0)
    scenarios_generated = models.IntegerField(default=0)
    total_iterations = models.IntegerField(default=0)
    
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(blank=True, null=True)
    duration_seconds = models.IntegerField(default=0)
    
    status = models.CharField(max_length=20, choices=SESSION_STATUS, default='completed')
    error_message = models.TextField(blank=True, null=True)
    
    class Meta:
        db_table = 'generation_sessions'
        ordering = ['-start_time']
        indexes = [
            models.Index(fields=['project', 'status']),
            models.Index(fields=['user', 'start_time']),
        ]
    
    def __str__(self):
        return f"Session {self.session_id} - {self.project.title} ({self.status})"
    
    def save(self, *args, **kwargs):
        if self.end_time and self.start_time:
            self.duration_seconds = int((self.end_time - self.start_time).total_seconds())
        super().save(*args, **kwargs)

class ProjectHistory(models.Model):
    ACTION_TYPES = [
        ('project_created', 'Project Created'),
        ('project_updated', 'Project Updated'),
        ('stories_generated', 'User Stories Generated'),
        ('wireframes_generated', 'Wireframes Generated'),
        ('scenarios_generated', 'Scenarios Generated'),
        ('export_created', 'Export Created'),
        ('review_iteration', 'Review Iteration'),
    ]
    
    history_id = models.CharField(max_length=50, unique=True, default=generate_short_uuid, primary_key=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='history_entries')
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='project_activities')
    generation_session = models.ForeignKey(GenerationSession, on_delete=models.SET_NULL, null=True, blank=True)
    
    action_type = models.CharField(max_length=50, choices=ACTION_TYPES)
    action_details = models.JSONField(default=dict, blank=True)
    description = models.TextField(blank=True, null=True)
    
    related_story = models.ForeignKey(UserStory, on_delete=models.SET_NULL, null=True, blank=True)
    related_wireframe = models.ForeignKey(Wireframe, on_delete=models.SET_NULL, null=True, blank=True)
    related_scenario = models.ForeignKey(Scenario, on_delete=models.SET_NULL, null=True, blank=True)
    
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'project_history'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['project', 'action_type']),
            models.Index(fields=['project', 'timestamp']),
            models.Index(fields=['user', 'timestamp']),
        ]
    
    def __str__(self):
        return f"{self.get_action_type_display()} - {self.project.title}"

class Export(models.Model):
    EXPORT_FORMATS = [
        ('html', 'HTML Documentation'),
        ('pdf', 'PDF Document'),
        ('word', 'Word Document'),
        ('json', 'JSON Data'),
        ('zip', 'Complete Package (ZIP)'),
    ]
    
    export_id = models.CharField(max_length=50, unique=True, default=generate_short_uuid, primary_key=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='exports')
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='exports')
    generation_session = models.ForeignKey(GenerationSession, on_delete=models.SET_NULL, null=True, blank=True)
    
    export_format = models.CharField(max_length=20, choices=EXPORT_FORMATS)
    file_path = models.CharField(max_length=500, blank=True, null=True)
    file_url = models.URLField(max_length=500, blank=True, null=True)
    file_size = models.BigIntegerField(default=0)
    
    include_stories = models.BooleanField(default=True)
    include_wireframes = models.BooleanField(default=True)
    include_scenarios = models.BooleanField(default=True)
    export_config = models.JSONField(default=dict, blank=True)
    
    status = models.CharField(max_length=20, default='completed')
    error_message = models.TextField(blank=True, null=True)
    
    exported_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'exports'
        ordering = ['-exported_at']
        indexes = [
            models.Index(fields=['project', 'export_format']),
            models.Index(fields=['user', 'exported_at']),
        ]
    
    def __str__(self):
        return f"{self.get_export_format_display()} - {self.project.title}"