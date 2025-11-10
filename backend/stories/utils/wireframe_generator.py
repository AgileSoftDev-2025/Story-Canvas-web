# stories/utils/wireframe_generator.py
import json
import re
import os
import replicate
from django.conf import settings
from stories.models import Project, UserStory
from rag_config import REPLICATE_API_TOKEN, MODEL_ID

class WireframeGenerator:
    def __init__(self):
        self.model_id = MODEL_ID
    
    def generate_html_documentation(self, project, user_stories, rag_db=None):
        """Generate HTML documentation dengan RAG patterns"""
        print(f"🌐 Generating RAG-enhanced HTML documentation for {project.title}...")
        
        # Infer pages dari user stories
        pages_map = self.infer_pages(user_stories)
        
        generated_pages = {}
        
        # Generate each page dengan RAG
        for page_name, stories in pages_map.items():
            print(f"   📄 Generating {page_name} dengan RAG patterns...")
            html = self.generate_page_html_with_rag(project, page_name, stories, rag_db)
            generated_pages[page_name] = html
        
        return {
            "role_pages": generated_pages,
            "generated_date": "2024-01-01",  # timestamp akan diisi nanti
            "used_rag_patterns": rag_db is not None
        }
    
    def infer_pages(self, user_stories):
        """Infer pages dari user stories - mirrors original logic"""
        pages = {}
        
        for story in user_stories:
            if isinstance(story, UserStory):
                text = story.story_text.lower()
                feature = (story.feature or "").lower()
                role = (story.role or "general").lower()
            else:
                text = (story.get('text') or "").lower()
                feature = (story.get('feature') or "").lower()
                role = (story.get('role') or "general").lower()
            
            page_keywords = {
                "login": ["login", "signin", "authenticate", "log in"],
                "dashboard": ["dashboard", "overview", "home", "main"],
                "profile": ["profile", "account", "settings", "user"],
                "products": ["product", "catalog", "item", "shop"],
                "cart": ["cart", "basket", "shopping"],
                "checkout": ["checkout", "payment", "purchase", "buy"],
                "search": ["search", "find", "lookup", "browse"],
                "admin": ["admin", "manage", "administration", "system"],
                "orders": ["order", "purchase", "history"],
                "analytics": ["analytics", "reports", "metrics"],
                "notifications": ["notification", "alert", "message"]
            }
            
            page_name = None
            for page_type, keywords in page_keywords.items():
                if any(keyword in text or keyword in feature for keyword in keywords):
                    page_name = page_type
                    break
            
            if not page_name and feature:
                page_name = feature.replace(" ", "-")
            elif not page_name:
                page_name = f"{role.replace(' ', '-')}-page"
            
            if page_name not in pages:
                pages[page_name] = []
            
            pages[page_name].append(story)
        
        return pages
    
    def generate_page_html_with_rag(self, project, page_name, stories, rag_db):
        """Generate HTML page dengan RAG UI patterns"""
        
        # Get relevant UI patterns
        ui_patterns = []
        if rag_db:
            ui_patterns = rag_db.retrieve_ui_patterns(page_name, k=2)
        
        # Build pattern context
        pattern_context = self._build_ui_pattern_context(ui_patterns)
        
        # Extract user stories text
        stories_text = "\n".join([
            f"- {story.story_text if isinstance(story, UserStory) else story.get('text', '')} "
            f"(Feature: {story.feature if isinstance(story, UserStory) else story.get('feature', 'General')})"
            for story in stories[:5]
        ])
        
        prompt = f"""
PROJECT: {project.title}
DOMAIN: {project.domain or 'General'}
PAGE: {page_name}

USER STORIES FOR THIS PAGE:
{stories_text}

RELEVANT UI PATTERNS:
{pattern_context}

TASK: Create a COMPREHENSIVE, MVP-READY HTML5 page for "{page_name}" that includes ALL essential UI components.

CRITICAL REQUIREMENTS:
- RETURN ONLY PURE HTML TAGS, NO CSS, NO JAVASCRIPT, NO EXTERNAL DEPENDENCIES
- Use semantic HTML5 elements: main, section, article, form, table
- Include COMPREHENSIVE form elements with proper attributes
- Add INTERACTIVE components that work with pure HTML
- Structure content with proper heading hierarchy (h1-h6)
- Make it USABLE and PRACTICAL for real users

MANDATORY UI COMPONENTS:
1. COMPREHENSIVE FORM ELEMENTS
2. DATA DISPLAY COMPONENTS: tables, cards, lists
3. INTERACTIVE ELEMENTS: buttons, links, expandable sections
4. CONTENT SECTIONS with clear purpose

Return ONLY the HTML code, no explanations, no markdown, no code blocks.
The output must be valid, complete HTML that can be rendered directly.
"""
        try:
            html_output = self._call_llm_api(prompt, temperature=0.2, max_tokens=4000)
            return self._extract_html_from_response(html_output)
        except Exception as e:
            print(f"⚠️ RAG HTML generation failed for {page_name}, using fallback: {e}")
            return self.generate_page_html_fallback(project, page_name, stories)
    
    def _build_ui_pattern_context(self, ui_patterns):
        """Build context dari UI patterns"""
        pattern_context = ""
        for i, pattern in enumerate(ui_patterns):
            metadata = pattern.get('metadata', {})
            pattern_context += f"""
UI PATTERN {i+1}: {metadata.get('page_type', 'Unknown')}
- Layout: {metadata.get('layout', 'N/A')}
- Required Elements: {', '.join(metadata.get('required_elements', []))}
- Best Practices: {metadata.get('best_practices', 'N/A')}
"""
        return pattern_context
    
    def generate_page_html_fallback(self, project, page_name, stories):
        """Fallback HTML generation"""
        # Group stories by feature
        stories_by_feature = {}
        for story in stories:
            if isinstance(story, UserStory):
                feature = story.feature or "General"
            else:
                feature = story.get('feature', 'General')
            
            if feature not in stories_by_feature:
                stories_by_feature[feature] = []
            stories_by_feature[feature].append(story)
        
        # Generate feature sections
        features_html = ""
        for feature, feature_stories in stories_by_feature.items():
            stories_list = "".join([
                f"<li>{story.story_text if isinstance(story, UserStory) else story.get('text', 'User story')}</li>"
                for story in feature_stories
            ])
            features_html += f"""
            <section class="feature-section">
                <h3>{feature}</h3>
                <ul class="stories-list">
                    {stories_list}
                </ul>
            </section>
            """
        
        # Generate interactive components berdasarkan page type
        interactive_components = self._generate_interactive_components(page_name, project)
        
        return f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{page_name.title()} - {project.title}</title>
</head>
<body>
    <main>
        <header class="page-header">
            <h1>{page_name.replace('-', ' ').title()}</h1>
            <p>Focused interface for {project.title}</p>
        </header>

        <section class="overview-cards">
            <h2>Project Context</h2>
            <div class="cards-grid">
                <article class="card">
                    <h3>Project</h3>
                    <p>{project.title}</p>
                </article>
                <article class="card">
                    <h3>Objective</h3>
                    <p>{project.objective or 'Not specified'}</p>
                </article>
            </div>
        </section>

        <section class="user-stories">
            <h2>User Stories</h2>
            {features_html}
        </section>

        <section class="interactive-components">
            <h2>Core Functionality</h2>
            {interactive_components}
        </section>

        <section class="data-section">
            <h2>Data Management</h2>
            <table>
                <caption>Sample Data Table</caption>
                <thead>
                    <tr>
                        <th scope="col">ID</th>
                        <th scope="col">Name</th>
                        <th scope="col">Role</th>
                        <th scope="col">Status</th>
                        <th scope="col">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>001</td>
                        <td>John Doe</td>
                        <td>Administrator</td>
                        <td><span class="status-active">Active</span></td>
                        <td>
                            <button type="button">Edit</button>
                            <button type="button">Delete</button>
                        </td>
                    </tr>
                    <tr>
                        <td>002</td>
                        <td>Jane Smith</td>
                        <td>User</td>
                        <td><span class="status-pending">Pending</span></td>
                        <td>
                            <button type="button">Edit</button>
                            <button type="button">Delete</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </section>
    </main>
</body>
</html>
"""
    
    def _generate_interactive_components(self, page_name, project):
        """Generate interactive components berdasarkan page type"""
        page_name_lower = page_name.lower()
        
        if "login" in page_name_lower:
            return """
            <form class="auth-form" method="post">
                <fieldset>
                    <legend>Login to Your Account</legend>
                    <div class="form-group">
                        <label for="email">Email Address:</label>
                        <input type="email" id="email" name="email" placeholder="your@email.com" required>
                    </div>
                    <div class="form-group">
                        <label for="password">Password:</label>
                        <input type="password" id="password" name="password" placeholder="Enter your password" required>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Login</button>
                        <button type="reset" class="btn-secondary">Clear</button>
                    </div>
                </fieldset>
            </form>
            """
        
        elif "dashboard" in page_name_lower:
            return """
            <div class="dashboard-grid">
                <div class="stats-cards">
                    <article class="stat-card">
                        <h3>Total Users</h3>
                        <p class="stat-number">1,234</p>
                        <p class="stat-change">+12% this month</p>
                    </article>
                    <article class="stat-card">
                        <h3>Revenue</h3>
                        <p class="stat-number">$45,678</p>
                        <p class="stat-change">+8% this month</p>
                    </article>
                </div>
                <div class="quick-actions">
                    <h3>Quick Actions</h3>
                    <div class="action-buttons">
                        <button type="button" class="btn-action">Add New User</button>
                        <button type="button" class="btn-action">Generate Report</button>
                    </div>
                </div>
            </div>
            """
        
        else:
            # Default comprehensive form
            return """
            <form class="comprehensive-form">
                <fieldset>
                    <legend>Sample Comprehensive Form</legend>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="fullname">Full Name:</label>
                            <input type="text" id="fullname" name="fullname" placeholder="Enter your full name" required>
                        </div>
                        <div class="form-group">
                            <label for="email">Email:</label>
                            <input type="email" id="email" name="email" placeholder="your@email.com" required>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Save Changes</button>
                        <button type="reset" class="btn-secondary">Reset Form</button>
                    </div>
                </fieldset>
            </form>
            """
    
    def _call_llm_api(self, prompt, temperature=0.0, max_tokens=1024):
        """Call LLM API"""
        try:
            api_token = os.getenv('REPLICATE_API_TOKEN')
            if not api_token or api_token == 'your_replicate_api_token_here':
                return ""  # Return empty untuk trigger fallback
            
            client = replicate.Client(api_token=api_token)
            
            input_data = {
                "prompt": prompt,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "top_p": 1.0
            }
            
            output = client.run(self.model_id, input=input_data)
            
            if isinstance(output, list):
                return "".join([str(item) for item in output])
            elif isinstance(output, dict):
                return json.dumps(output)
            else:
                return str(output)
                
        except Exception as e:
            print(f"Error calling API model: {e}")
            return ""
    
    def _extract_html_from_response(self, response):
        """Extract HTML dari response"""
        if "<html" in response.lower():
            return response
        
        # Fallback basic HTML structure
        return f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated Page</title>
</head>
<body>
    <main>
        <h1>Generated Interface</h1>
        <p>This is a fallback HTML page.</p>
        {response}
    </main>
</body>
</html>
"""