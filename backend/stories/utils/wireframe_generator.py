import json
import re
import os
import replicate
from django.conf import settings
from django.utils import timezone
from stories.models import Project, UserStory

class WireframeGenerator:
    def __init__(self):
        self.model_id = getattr(settings, 'MODEL_ID', 'ibm-granite/granite-3.3-8b-instruct')
    
    def generate_html_documentation(self, project_info, user_stories, rag_db=None):
        """
        RAG-enhanced HTML documentation generation - COMPREHENSIVE MVP HTML ONLY
        EXACT SAME as Colab version
        """
        print("🌐 Generating RAG-enhanced MVP HTML documentation...")

        # -------- PAGE INFERENCE (EXACT SAME AS COLAB) --------
        def infer_pages(user_stories):
            pages = {}
            for story in user_stories:
                if isinstance(story, UserStory):
                    text = story.story_text.lower()
                    feature = (story.feature or "").strip()
                    role = (story.role or "general").strip()
                else:
                    # Handle dict format from Colab
                    text = (story.get("text") or "").lower()
                    feature = (story.get("feature") or "").strip()
                    role = (story.get("role") or "general").strip()

                page_keywords = {
                    "login": "login", "signin": "login", "authenticate": "login", "log in": "login",
                    "dashboard": "dashboard", "overview": "dashboard", "home": "dashboard", "main": "dashboard",
                    "profile": "profile", "account": "profile", "settings": "profile", "user": "profile",
                    "search": "search", "find": "search", "lookup": "search", "browse": "search",
                    "product": "products", "catalog": "products", "item": "products", "shop": "products",
                    "cart": "cart", "basket": "cart", "shopping": "cart",
                    "checkout": "checkout", "payment": "checkout", "purchase": "checkout", "buy": "checkout",
                    "admin": "admin", "manage": "admin", "administration": "admin", "system": "admin",
                    "order": "orders", "purchase": "orders", "history": "orders",
                    "analytics": "analytics", "reports": "analytics", "metrics": "analytics",
                    "notification": "notifications", "alert": "notifications", "message": "notifications"
                }

                page_name = None
                for keyword, page_type in page_keywords.items():
                    if keyword in text or keyword in feature.lower():
                        page_name = page_type
                        break

                if not page_name and feature:
                    page_name = feature.lower().replace(" ", "-")
                elif not page_name:
                    page_name = f"{role.lower().replace(' ', '-')}-page"

                pages.setdefault(page_name, []).append(story)
            return pages

        # -------- RAG-ENHANCED PAGE GENERATION (EXACT SAME AS COLAB) --------
        def generate_page_html_with_rag(project_info, page_name, stories, rag_db):
            """Generate COMPREHENSIVE MVP HTML using RAG patterns + LLM - PURE HTML ONLY"""

            # Get relevant UI patterns
            ui_patterns = []
            if rag_db:
                ui_patterns = rag_db.retrieve_ui_patterns(page_name, k=2)

            # Build pattern context (EXACT SAME AS COLAB)
            pattern_context = ""
            for i, pattern in enumerate(ui_patterns):
                metadata = pattern['metadata']
                pattern_context += f"""
            UI PATTERN {i+1}: {metadata['page_type']}
            - Layout: {metadata['layout']}
            - Required Elements: {', '.join(metadata['required_elements'])}
            - Optional Elements: {', '.join(metadata.get('optional_elements', []))}
            - Best Practices: {metadata['best_practices']}
            - Common Variations: {metadata.get('common_variations', 'N/A')}
            """

            # Get project patterns for additional context (EXACT SAME AS COLAB)
            project_description = self.format_project_description(project_info)
            project_patterns = []
            if rag_db:
                project_patterns = rag_db.retrieve_similar_patterns(project_description, k=2)

            project_pattern_context = ""
            for i, pattern in enumerate(project_patterns):
                metadata = pattern['metadata']
                project_pattern_context += f"""
            PROJECT PATTERN {i+1}: {metadata['project_type']}
            - Description: {metadata['description']}
            - Key Features: {metadata['key_features']}
            - Target Users: {metadata['target_users']}
            """

            # Extract user stories for this page (EXACT SAME AS COLAB)
            page_stories_text = "\n".join([
                f"- {story.story_text if isinstance(story, UserStory) else story.get('text', '')} "
                f"(Feature: {story.feature if isinstance(story, UserStory) else story.get('feature', 'General')})"
                for story in stories[:10]
            ])

            # EXACT SAME PROMPT AS COLAB
            prompt = f"""
PROJECT: {project_info.get('title', 'Untitled Project')}
DOMAIN: {self.detect_domain(self.format_project_description(project_info))}
PAGE: {page_name}

USER STORIES FOR THIS PAGE:
{page_stories_text}

RELEVANT UI PATTERNS:
{pattern_context}

PROJECT CONTEXT:
{project_pattern_context}

TASK: Create a COMPREHENSIVE, MVP-READY HTML5 page for "{page_name}" that includes ALL essential UI components.

CRITICAL REQUIREMENTS:
- RETURN ONLY PURE HTML TAGS, NO CSS, NO JAVASCRIPT, NO EXTERNAL DEPENDENCIES
- NO NAVIGATION MENUS, NO HEADERS WITH LINKS, NO FOOTERS WITH LINKS
- Create a FOCUSED interface with only the core functionality for this specific page
- Use semantic HTML5 elements: main, section, article, form, table
- Include COMPREHENSIVE form elements with proper attributes
- Add INTERACTIVE components that work with pure HTML
- Structure content with proper heading hierarchy (h1-h6)
- Make it USABLE and PRACTICAL for real users

MANDATORY UI COMPONENTS TO INCLUDE:

1. COMPREHENSIVE FORM ELEMENTS:
   - Text inputs with different types (text, email, password, number, tel, url)
   - Textareas with placeholder text
   - Select dropdowns with multiple options
   - Radio button groups
   - Checkbox groups
   - File upload inputs
   - Date and time pickers
   - Range sliders
   - Search inputs
   - Submit and reset buttons
   - Fieldset and legend for grouping
   - Required field indicators

2. DATA DISPLAY COMPONENTS:
   - Tables with headers, body, and footer
   - Card layouts with images and text
   - Lists (ordered, unordered) for content
   - Definition lists for key-value pairs
   - Progress bars
   - Meter elements

3. INTERACTIVE ELEMENTS:
   - Multiple button types (submit, button, reset)
   - Button groups
   - Links with different states
   - Details/summary expandable sections
   - Dialog/modal structures (using details)
   - Tab-like interfaces (using radio buttons and labels)

4. CONTENT SECTIONS:
   - Main content area with clear purpose
   - Feature sections with relevant components
   - User input forms specific to the page
   - Data display areas
   - Action buttons and controls

5. SPECIFIC PAGE COMPONENTS:
   - Login: Full authentication form only
   - Dashboard: Stats cards, recent activity, quick actions only
   - Product Listing: Product cards, filters, sort options only
   - Profile: User info form, avatar upload only
   - Checkout: Order summary, payment form only

HTML STRUCTURE GUIDELINES:
- Use proper form validation attributes (required, pattern, min, max, etc.)
- Include accessible labels for all form elements
- Use ARIA attributes where appropriate
- Add placeholder text and sample content
- Create realistic data in tables and lists
- Ensure logical tab order
- Include error message containers
- Add success confirmation sections
- NO NAVIGATION BARS, NO MENUS, NO SITE-WIDE HEADERS/FOOTERS

IMPORTANT: This should be a FOCUSED, SINGLE-PURPOSE HTML page that provides only the core functionality.
DO NOT include any navigation to other pages or global site elements.

FORMAT: Return ONLY the HTML code, no explanations, no markdown, no code blocks.
The output must be valid, complete HTML that can be rendered directly in a browser.
"""

            try:
                html_output = self._call_llm_api(prompt, temperature=0.2, max_tokens=6000)
                return self._extract_html_from_response(html_output)
            except Exception as e:
                print(f"⚠️ RAG HTML generation failed for {page_name}, using fallback: {e}")
                return self.generate_page_html_fallback(project_info, page_name, stories)

        def generate_page_html_fallback(project_info, page_name, stories):
            """Comprehensive fallback HTML generation with MVP components - NO NAVIGATION"""
            # Group stories by feature
            stories_by_feature = {}
            for story in stories:
                if isinstance(story, UserStory):
                    feature = story.feature or "General"
                else:
                    feature = story.get("feature", "General")
                stories_by_feature.setdefault(feature, []).append(story)

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

            # Generate interactive components based on page type
            interactive_components = self.generate_interactive_components(page_name, project_info)

            return f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{page_name.title()} - {project_info.get('title', 'Project')}</title>
</head>
<body>
    <main>
        <!-- Page Header -->
        <header class="page-header">
            <h1>{page_name.replace('-', ' ').title()}</h1>
            <p>Focused interface for {project_info.get('title', 'project')}</p>
        </header>

        <!-- Project Overview Cards -->
        <section class="overview-cards">
            <h2>Project Context</h2>
            <div class="cards-grid">
                <article class="card">
                    <h3>Project</h3>
                    <p>{project_info.get('title', 'Untitled Project')}</p>
                </article>
                <article class="card">
                    <h3>Objective</h3>
                    <p>{project_info.get('objective', 'Not specified')}</p>
                </article>
            </div>
        </section>

        <!-- User Stories Section -->
        <section class="user-stories">
            <h2>User Stories</h2>
            {features_html}
        </section>

        <!-- Interactive Components Section -->
        <section class="interactive-components">
            <h2>Core Functionality</h2>
            {interactive_components}
        </section>

        <!-- Data Tables Section -->
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

        <!-- FAQ Section -->
        <section class="faq-section">
            <h2>Frequently Asked Questions</h2>
            <details>
                <summary>How do I use this page?</summary>
                <p>Use the form elements and buttons above to interact with the system.</p>
            </details>
            <details>
                <summary>Where can I find help?</summary>
                <p>Refer to the user stories section for functionality details.</p>
            </details>
        </section>
    </main>
</body>
</html>
"""

        # -------- RUN PIPELINE (EXACT SAME AS COLAB) --------
        pages_map = infer_pages(user_stories)
        generated_pages = {}

        # Generate each page with RAG patterns
        for page_name, stories in pages_map.items():
            print(f"   📄 Generating {page_name} with focused MVP components...")
            html = generate_page_html_with_rag(project_info, page_name, stories, rag_db)
            generated_pages[page_name] = html

        return {
            "role_pages": generated_pages,
            "generated_date": timezone.now().isoformat(),
            "used_rag_patterns": rag_db is not None
        }

    def generate_interactive_components(self, page_name, project_info):
        """Generate page-specific interactive components - NO NAVIGATION (EXACT SAME AS COLAB)"""
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

                    <div class="form-options">
                        <label>
                            <input type="checkbox" name="remember" value="1">
                            Remember me
                        </label>
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
                <!-- Stats Cards -->
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
                    <article class="stat-card">
                        <h3>Orders</h3>
                        <p class="stat-number">567</p>
                        <p class="stat-change">+15% this month</p>
                    </article>
                </div>

                <!-- Quick Actions -->
                <div class="quick-actions">
                    <h3>Quick Actions</h3>
                    <div class="action-buttons">
                        <button type="button" class="btn-action">Add New User</button>
                        <button type="button" class="btn-action">Generate Report</button>
                        <button type="button" class="btn-action">View Analytics</button>
                    </div>
                </div>

                <!-- Recent Activity -->
                <div class="recent-activity">
                    <h3>Recent Activity</h3>
                    <ul class="activity-list">
                        <li>User John Doe logged in</li>
                        <li>New order #1234 placed</li>
                        <li>System backup completed</li>
                    </ul>
                </div>
            </div>
            """

        elif "product" in page_name_lower:
            return """
            <div class="product-interface">
                <!-- Search and Filters -->
                <div class="product-controls">
                    <form class="search-form">
                        <input type="search" placeholder="Search products..." aria-label="Search products">
                        <button type="submit">Search</button>
                    </form>

                    <div class="filter-options">
                        <label>
                            Category:
                            <select>
                                <option value="">All Categories</option>
                                <option value="electronics">Electronics</option>
                                <option value="clothing">Clothing</option>
                                <option value="books">Books</option>
                            </select>
                        </label>
                    </div>
                </div>

                <!-- Product Grid -->
                <div class="product-grid">
                    <article class="product-card">
                        <h4>Product Name 1</h4>
                        <p class="price">$99.99</p>
                        <p class="description">Product description goes here</p>
                        <div class="product-actions">
                            <button type="button">Add to Cart</button>
                            <button type="button">View Details</button>
                        </div>
                    </article>

                    <article class="product-card">
                        <h4>Product Name 2</h4>
                        <p class="price">$149.99</p>
                        <p class="description">Product description goes here</p>
                        <div class="product-actions">
                            <button type="button">Add to Cart</button>
                            <button type="button">View Details</button>
                        </div>
                    </article>
                </div>
            </div>
            """

        else:
            # Default comprehensive form (EXACT SAME AS COLAB)
            return """
            <form class="comprehensive-form">
                <fieldset>
                    <legend>Sample Comprehensive Form</legend>

                    <!-- Text Inputs -->
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

                    <!-- Radio Group -->
                    <fieldset class="radio-group">
                        <legend>Account Type:</legend>
                        <label>
                            <input type="radio" name="accountType" value="personal" checked>
                            Personal
                        </label>
                        <label>
                            <input type="radio" name="accountType" value="business">
                            Business
                        </label>
                    </fieldset>

                    <!-- Checkbox Group -->
                    <fieldset class="checkbox-group">
                        <legend>Preferences:</legend>
                        <label>
                            <input type="checkbox" name="newsletter" value="1">
                            Subscribe to newsletter
                        </label>
                        <label>
                            <input type="checkbox" name="notifications" value="1" checked>
                            Enable notifications
                        </label>
                    </fieldset>

                    <!-- Select and Textarea -->
                    <div class="form-row">
                        <div class="form-group">
                            <label for="country">Country:</label>
                            <select id="country" name="country" required>
                                <option value="">Select a country</option>
                                <option value="us">United States</option>
                                <option value="ca">Canada</option>
                                <option value="uk">United Kingdom</option>
                            </select>
                        </div>
                    </div>

                    <!-- Textarea -->
                    <div class="form-group">
                        <label for="comments">Additional Comments:</label>
                        <textarea id="comments" name="comments" placeholder="Enter any additional comments..." rows="4"></textarea>
                    </div>

                    <!-- Form Actions -->
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Save Changes</button>
                        <button type="reset" class="btn-secondary">Reset Form</button>
                    </div>
                </fieldset>
            </form>
            """

    def format_project_description(self, project_info):
        """Format project description (EXACT SAME AS COLAB)"""
        if isinstance(project_info, Project):
            # Handle Django model
            description = f"""
            Title: {project_info.title}
            Objective: {project_info.objective or 'Not specified'}
            Users: {', '.join(project_info.users_data or [])}
            Features: {', '.join(project_info.features_data or [])}
            Scope: {project_info.scope or 'Not specified'}
            Flow: {project_info.flow or 'Not specified'}
            Additional Information: {project_info.additional_info or 'None'}
            """
        else:
            # Handle dict format from Colab
            description = f"""
            Title: {project_info.get('title', 'Untitled Project')}
            Objective: {project_info.get('objective', 'Not specified')}
            Users: {', '.join(project_info.get('users', []))}
            Features: {', '.join(project_info.get('features', []))}
            Scope: {project_info.get('scope', 'Not specified')}
            Flow: {project_info.get('flow', 'Not specified')}
            Additional Information: {project_info.get('additional_info', 'None')}
            """
        return description

    def detect_domain(self, description):
        """Detect domain from description (EXACT SAME AS COLAB)"""
        description_lower = description.lower()
        domain_keywords = {
            "E-commerce": ["shop", "buy", "product", "cart", "order", "payment", "ecommerce"],
            "Healthcare": ["patient", "doctor", "medical", "health", "appointment", "hospital", "monitoring", "vital"],
            "Education": ["student", "teacher", "learn", "course", "assignment", "school"],
            "Finance": ["bank", "money", "account", "transaction", "payment", "financial"],
            "Social Media": ["social", "profile", "post", "share", "connect", "message"],
            "Enterprise": ["business", "enterprise", "company", "organization", "workflow"],
            "IoT": ["iot", "internet of things", "sensor", "device", "smart"],
            "Gaming": ["game", "player", "level", "score", "multiplayer"]
        }

        for domain, keywords in domain_keywords.items():
            if any(keyword in description_lower for keyword in keywords):
                return domain
        return "General"

    def _call_llm_api(self, prompt, temperature=0.0, max_tokens=1024):
        """Call LLM API using Django settings"""
        try:
            api_token = os.getenv('REPLICATE_API_TOKEN')
            if not api_token or api_token == 'your_replicate_api_token_here':
                raise Exception("Replicate API token not configured")
            
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
            raise

    def _extract_html_from_response(self, response):
        """Extract HTML from response (EXACT SAME AS COLAB)"""
        if not response:
            return self._generate_fallback_html()
            
        html_match = re.search(r'<html.*?>.*?</html>', response, re.DOTALL | re.IGNORECASE)
        if html_match:
            return html_match.group(0)

        body_match = re.search(r'<body.*?>.*?</body>', response, re.DOTALL | re.IGNORECASE)
        if body_match:
            return f"<!DOCTYPE html><html><head><title>Generated Documentation</title></head>{body_match.group(0)}</html>"

        return f"""<!DOCTYPE html>
<html>
<head>
    <title>Generated Documentation</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; }}
        .story {{ border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; }}
        .high-priority {{ border-left: 4px solid #dc3545; }}
        .medium-priority {{ border-left: 4px solid #ffc107; }}
        .low-priority {{ border-left: 4px solid #28a745; }}
    </style>
</head>
<body>
{response}
</body>
</html>"""

    def _generate_fallback_html(self):
        """Generate fallback HTML when LLM fails"""
        return """<!DOCTYPE html>
<html>
<head>
    <title>Generated Documentation</title>
</head>
<body>
    <main>
        <h1>Documentation Interface</h1>
        <p>This is a fallback HTML page generated when the AI service is unavailable.</p>
        <form>
            <fieldset>
                <legend>Sample Form</legend>
                <div>
                    <label for="username">Username:</label>
                    <input type="text" id="username" name="username" placeholder="Enter username">
                </div>
                <div>
                    <label for="email">Email:</label>
                    <input type="email" id="email" name="email" placeholder="your@email.com">
                </div>
                <button type="submit">Submit</button>
            </fieldset>
        </form>
    </main>
</body>
</html>"""