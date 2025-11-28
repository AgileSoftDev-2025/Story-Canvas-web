import os
import numpy as np
import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions
from sentence_transformers import SentenceTransformer
from django.conf import settings

class ProjectRAGVectorDB:
    def __init__(self, collection_name="project_patterns"):
        # FIX: Initialize embedding model with proper device handling
        try:
            self.embed_model = SentenceTransformer(
                os.getenv('EMBEDDING_MODEL', 'all-MiniLM-L6-v2'),
                device='cpu'  # Force CPU to avoid GPU/meta tensor issues
            )
        except Exception as e:
            print(f"⚠️ Error initializing embedding model: {e}")
            # Fallback: don't initialize embed_model for UI patterns
            self.embed_model = None
        
        chroma_path = os.getenv('CHROMA_PATH', './project_rag_store')
        
        # FIX: Initialize ChromaDB with proper error handling
        try:
            self.client = chromadb.Client(Settings(
                persist_directory=chroma_path,
                is_persistent=True
            ))
            self.collection = self._initialize_collection(collection_name)
        except Exception as e:
            print(f"⚠️ Error initializing ChromaDB: {e}")
            self.client = None
            self.collection = None
        
        self.project_patterns = self._get_project_patterns()
        self.ui_patterns = self._get_ui_patterns()
        self._populate_vector_db()

    def _initialize_collection(self, collection_name):
        try:
            # FIX: Use ChromaDB's built-in embedding function
            return self.client.get_or_create_collection(
                name=collection_name,
                embedding_function=embedding_functions.SentenceTransformerEmbeddingFunction(
                    model_name=os.getenv('EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
                ),
                metadata={"hnsw:space": "cosine"}
            )
        except Exception as e:
            print(f"⚠️ Error getting collection, creating new: {e}")
            return self.client.create_collection(
                name=collection_name,
                embedding_function=embedding_functions.SentenceTransformerEmbeddingFunction(
                    model_name=os.getenv('EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
                ),
                metadata={"hnsw:space": "cosine"}
            )

    def _get_project_patterns(self):
        """EXACT SAME as Colab - comprehensive project patterns"""
        return [
            {
                "project_type": "E-commerce Platform",
                "description": "Online shopping system with products, cart, and checkout",
                "target_users": "Customer, Admin, Seller",
                "key_features": "product search, shopping cart, payment processing, order management",
                "user_story_patterns": "As a {user}, I want to {action} so that {benefit}; As a {user}, I need to {action} to achieve {goal}; As a {user}, I should be able to {action} for {purpose}"
            },
            {
                "project_type": "Healthcare System",
                "description": "Medical record management and patient care system",
                "target_users": "Patient, Doctor, Nurse, Administrator",
                "key_features": "appointment scheduling, medical records, prescription management, billing",
                "user_story_patterns": "As a {user}, I want to {action} so that {medical_benefit}; As a {user}, I need to {action} to provide {care_goal}; As a {user}, I should be able to {action} for {healthcare_purpose}"
            },
            {
                "project_type": "Education Platform",
                "description": "Online learning management system",
                "target_users": "Student, Teacher, Administrator, Parent",
                "key_features": "course management, assignment submission, grading system, attendance tracking",
                "user_story_patterns": "As a {user}, I want to {action} so that {learning_benefit}; As a {user}, I need to {action} to enhance {educational_goal}; As a {user}, I should be able to {action} for {academic_purpose}"
            },
            {
                "project_type": "Finance Application",
                "description": "Banking and financial management system",
                "target_users": "Customer, Account Manager, Financial Advisor",
                "key_features": "account management, transaction processing, investment tracking, financial reports",
                "user_story_patterns": "As a {user}, I want to {action} so that {financial_benefit}; As a {user}, I need to {action} to manage {financial_goal}; As a {user}, I should be able to {action} for {banking_purpose}"
            },
            {
                "project_type": "Social Media Platform",
                "description": "Social networking and content sharing application",
                "target_users": "User, Content Creator, Moderator, Advertiser",
                "key_features": "profile management, content posting, messaging, news feed",
                "user_story_patterns": "As a {user}, I want to {action} so that {social_benefit}; As a {user}, I need to {action} to connect with {social_goal}; As a {user}, I should be able to {action} for {networking_purpose}"
            },
            {
                "project_type": "Health Monitoring System",
                "description": "System for tracking health metrics and providing alerts",
                "target_users": "Patient, Doctor, Caregiver, Family Member",
                "key_features": "vital sign monitoring, alert system, health reports, communication platform",
                "user_story_patterns": "As a {user}, I want to {action} so that {health_benefit}; As a {user}, I need to {action} to monitor {health_metric}; As a {user}, I should be able to {action} for {preventive_care}"
            },
            {
                "project_type": "Agriculture Monitoring System",
                "description": "IoT-based system for monitoring crops, soil conditions, and farm operations",
                "target_users": "Farmer, Agronomist, Farm Manager, Field Worker",
                "key_features": "soil moisture monitoring, weather tracking, crop health analysis, irrigation control, yield prediction",
                "user_story_patterns": "As a {user}, I want to {action} so that {agricultural_benefit}; As a {user}, I need to {action} to optimize {farm_operation}; As a {user}, I should be able to {action} for {crop_management}"
            },
            {
                "project_type": "Mental Health Application",
                "description": "Digital platform for mental wellness tracking and support",
                "target_users": "User, Therapist, Counselor, Caregiver",
                "key_features": "mood tracking, meditation guides, therapy sessions, progress monitoring, crisis support",
                "user_story_patterns": "As a {user}, I want to {action} so that {mental_health_benefit}; As a {user}, I need to {action} to manage {emotional_state}; As a {user}, I should be able to {action} for {wellness_improvement}"
            }
        ]

    def _populate_vector_db(self):
        """EXACT SAME population logic as Colab"""
        try:
            if not self.collection:
                print("⚠️ No collection available, skipping population")
                return
                
            current_count = self.collection.count()
            if current_count == 0:
                documents = []
                metadatas = []
                ids = []

                for i, pattern in enumerate(self.project_patterns):
                    enhanced_doc = f"""
                    Project Type: {pattern['project_type']}
                    Description: {pattern['description']}
                    Target Users: {pattern['target_users']}
                    Key Features: {pattern['key_features']}
                    User Story Patterns: {pattern['user_story_patterns']}
                    """
                    documents.append(enhanced_doc)
                    metadatas.append(pattern)
                    ids.append(f"pattern_{i}")

                self.collection.add(
                    documents=documents,
                    metadatas=metadatas,
                    ids=ids
                )
                print(f"✅ Project Vector DB populated with {len(documents)} patterns")
            else:
                print(f"✅ Vector DB already has {current_count} patterns")
                
        except Exception as e:
            print(f"⚠️ Error populating vector DB: {e}")
            print("⚠️ Using in-memory patterns as fallback")

    def retrieve_similar_patterns(self, query: str, k: int = 3):
        """EXACT SAME retrieval logic as Colab"""
        try:
            if not self.collection:
                print("⚠️ No collection available, using fallback patterns")
                return [{'metadata': pattern} for pattern in self.project_patterns[:k]]
                
            n_results = max(1, min(k, self.collection.count()))
            if n_results == 0:
                print("⚠️ No patterns in DB, using fallback patterns")
                return [{'metadata': pattern} for pattern in self.project_patterns[:k]]
                
            results = self.collection.query(
                query_texts=[query],
                n_results=n_results,
                include=['documents', 'metadatas', 'distances']
            )

            retrieved_patterns = []
            if results['documents'] and len(results['documents'][0]) > 0:
                for i in range(len(results['documents'][0])):
                    retrieved_patterns.append({
                        'document': results['documents'][0][i],
                        'metadata': results['metadatas'][0][i],
                        'distance': results['distances'][0][i] if results.get('distances') else 0
                    })
                print(f"✅ Retrieved {len(retrieved_patterns)} similar patterns")
                return retrieved_patterns
            else:
                print("⚠️ No results from vector query, using fallback")
                return [{'metadata': pattern} for pattern in self.project_patterns[:k]]
                
        except Exception as e:
            print(f"⚠️ Error in vector DB retrieval: {e}")
            fallback_patterns = [{'metadata': pattern} for pattern in self.project_patterns[:k]]
            print(f"⚠️ Using {len(fallback_patterns)} fallback patterns")
            return fallback_patterns

    def _get_ui_patterns(self):
        """EXACT SAME UI patterns as Colab"""
        return [
            {
                "page_type": "Login Page",
                "description": "User authentication page",
                "layout": "centered-form",
                "required_elements": ["logo", "username field", "password field", "submit button"],
                "optional_elements": ["remember me", "forgot password", "social login", "register link"],
                "best_practices": "Simple form, clear error messages, mobile responsive",
                "common_variations": ["split-screen with image", "modal login", "full-page centered"]
            },
            {
                "page_type": "Dashboard",
                "description": "Main user dashboard with overview",
                "layout": "sidebar-main",
                "required_elements": ["navigation menu", "main content area", "user profile"],
                "optional_elements": ["search bar", "notifications", "quick actions", "metrics cards", "recent activity"],
                "best_practices": "Clear information hierarchy, actionable items, personalization",
                "common_variations": ["analytics dashboard", "project management", "e-commerce admin"]
            },
            {
                "page_type": "Product Listing",
                "description": "E-commerce product catalog page",
                "layout": "grid-layout",
                "required_elements": ["product cards", "filter options", "sort controls"],
                "optional_elements": ["category navigation", "search bar", "wishlist", "compare", "pagination"],
                "best_practices": "Clear product images, prominent pricing, quick add to cart",
                "common_variations": ["list view", "masonry grid", "category pages"]
            },
            {
                "page_type": "User Profile",
                "description": "User profile management page",
                "layout": "header-content",
                "required_elements": ["profile picture", "user information", "edit controls"],
                "optional_elements": ["activity history", "preferences", "security settings", "connected accounts"],
                "best_practices": "Easy editing, clear save actions, profile completion indicators",
                "common_variations": ["social profile", "professional profile", "account settings"]
            },
            {
                "page_type": "Checkout Page",
                "description": "E-commerce purchase completion",
                "layout": "multi-step",
                "required_elements": ["cart summary", "shipping form", "payment form", "order review"],
                "optional_elements": ["promo code", "guest checkout", "trust badges", "security icons"],
                "best_practices": "Progress indicator, clear pricing, multiple payment options",
                "common_variations": ["one-page checkout", "multi-step wizard", "express checkout"]
            },
            {
                "page_type": "Search Results",
                "description": "Page displaying search outcomes",
                "layout": "results-list",
                "required_elements": ["search bar", "results list", "result count"],
                "optional_elements": ["filters sidebar", "sort options", "pagination", "no results state"],
                "best_practices": "Relevant ranking, fast loading, clear result previews",
                "common_variations": ["product search", "content search", "user search"]
            }
        ]

    def retrieve_ui_patterns(self, query: str, k: int = 2):
        """EXACT SAME UI pattern retrieval as Colab"""
        try:
            # FIX: Check if embed_model is available
            if not self.embed_model:
                print("⚠️ Embedding model not available, using keyword-based UI pattern matching")
                return self._retrieve_ui_patterns_keyword_based(query, k)
            
            query_embedding = self.embed_model.encode([query])[0]
            
            patterns_with_similarity = []
            for pattern in self.ui_patterns:
                pattern_text = f"{pattern['page_type']} {pattern['description']} {pattern['best_practices']}"
                pattern_embedding = self.embed_model.encode([pattern_text])[0]
                
                similarity = np.dot(query_embedding, pattern_embedding) / (
                    np.linalg.norm(query_embedding) * np.linalg.norm(pattern_embedding)
                )
                
                patterns_with_similarity.append({
                    'metadata': pattern,
                    'similarity': similarity
                })
            
            patterns_with_similarity.sort(key=lambda x: x['similarity'], reverse=True)
            result = [{'metadata': p['metadata']} for p in patterns_with_similarity[:k]]
            print(f"✅ Retrieved {len(result)} UI patterns for: {query}")
            return result
            
        except Exception as e:
            print(f"⚠️ Error in UI pattern retrieval: {e}")
            return self._retrieve_ui_patterns_keyword_based(query, k)

    def _retrieve_ui_patterns_keyword_based(self, query: str, k: int = 2):
        """Fallback keyword-based UI pattern retrieval"""
        query_lower = query.lower()
        
        # Simple keyword matching
        patterns_with_score = []
        for pattern in self.ui_patterns:
            score = 0
            pattern_text = f"{pattern['page_type']} {pattern['description']} {pattern['best_practices']}".lower()
            
            # Check for exact matches
            if query_lower in pattern_text:
                score += 10
            if any(keyword in query_lower for keyword in pattern_text.split()):
                score += 5
            if pattern['page_type'].lower() in query_lower:
                score += 8
                
            patterns_with_score.append({
                'metadata': pattern,
                'score': score
            })
        
        patterns_with_score.sort(key=lambda x: x['score'], reverse=True)
        result = [{'metadata': p['metadata']} for p in patterns_with_score[:k] if p['score'] > 0]
        
        if not result:
            result = [{'metadata': pattern} for pattern in self.ui_patterns[:k]]
            
        print(f"✅ Retrieved {len(result)} UI patterns using keyword matching for: {query}")
        return result

    def get_all_project_patterns(self):
        return self.project_patterns

    def get_all_ui_patterns(self):
        return self.ui_patterns

    def get_collection_stats(self):
        try:
            if not self.collection:
                return {
                    "error": "No collection available",
                    "project_patterns_count": len(self.project_patterns),
                    "ui_patterns_count": len(self.ui_patterns)
                }
                
            count = self.collection.count()
            return {
                "total_patterns": count,
                "project_patterns_count": len(self.project_patterns),
                "ui_patterns_count": len(self.ui_patterns),
                "persistence_path": os.getenv('CHROMA_PATH', './project_rag_store')
            }
        except Exception as e:
            return {
                "error": str(e),
                "project_patterns_count": len(self.project_patterns),
                "ui_patterns_count": len(self.ui_patterns)
            }