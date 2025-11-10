# stories/rag_vector_db.py
import os
import numpy as np
import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions
from sentence_transformers import SentenceTransformer
from .rag_config import RAG_CONFIG

class ProjectRAGVectorDB:
    def __init__(self, collection_name="project_patterns"):
        self.embed_model = SentenceTransformer("all-MiniLM-L6-v2")
        self.client = chromadb.Client(Settings(
            persist_directory=RAG_CONFIG['chroma_path']
        ))
        self.collection = self._initialize_collection(collection_name)
        self.project_patterns = self._get_project_patterns()
        self.ui_patterns = self._get_ui_patterns()
        self._populate_vector_db()

    def _initialize_collection(self, collection_name):
        try:
            return self.client.get_or_create_collection(
                name=collection_name,
                embedding_function=embedding_functions.SentenceTransformerEmbeddingFunction(
                    model_name="all-MiniLM-L6-v2"
                )
            )
        except:
            return self.client.create_collection(
                name=collection_name,
                embedding_function=embedding_functions.SentenceTransformerEmbeddingFunction(
                    model_name="all-MiniLM-L6-v2"
                )
            )

    def _get_project_patterns(self):
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
            }
        ]

    def _populate_vector_db(self):
        if self.collection.count() == 0:
            documents = []
            metadatas = []
            ids = []

            for i, pattern in enumerate(self.project_patterns):
                enhanced_doc = f"""
                Project Type: {pattern['project_type']}
                Description: {pattern['description']}
                Target Users: {pattern['target_users']}
                Key Features: {pattern['key_features']}
                """
                documents.append(enhanced_doc)
                metadatas.append(pattern)
                ids.append(f"pattern_{i}")

            try:
                self.collection.add(
                    documents=documents,
                    metadatas=metadatas,
                    ids=ids
                )
                print(f"✅ Project Vector DB populated with {len(documents)} patterns")
            except Exception as e:
                print(f"⚠️ Error populating vector DB: {e}")

    def retrieve_similar_patterns(self, query: str, k: int = 3):
        try:
            n_results = max(1, min(k, self.collection.count()))
            results = self.collection.query(
                query_texts=[query],
                n_results=n_results
            )

            retrieved_patterns = []
            for i in range(len(results['documents'][0])):
                retrieved_patterns.append({
                    'document': results['documents'][0][i],
                    'metadata': results['metadatas'][0][i],
                    'distance': results['distances'][0][i] if 'distances' in results else 0
                })
            return retrieved_patterns
        except Exception as e:
            print(f"⚠️ Error in vector DB retrieval: {e}")
            return [{'metadata': pattern} for pattern in self.project_patterns[:k]]

    def _get_ui_patterns(self):
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
            }
        ]

    def retrieve_ui_patterns(self, query: str, k: int = 2):
        try:
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
            return [{'metadata': p['metadata']} for p in patterns_with_similarity[:k]]
            
        except Exception as e:
            print(f"⚠️ Error in UI pattern retrieval: {e}")
            return [{'metadata': pattern} for pattern in self.ui_patterns[:k]]