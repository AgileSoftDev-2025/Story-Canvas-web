# stories/rag_config.py
import os
from django.conf import settings

# Configuration - mirrors Google Colab
MODEL_ID = "ibm-granite/granite-3.3-8b-instruct"
CHROMA_PATH = getattr(settings, 'CHROMA_DB_PATH', './project_rag_store')

# API Configuration
REPLICATE_API_TOKEN = os.getenv('REPLICATE_API_TOKEN', 'your_replicate_api_token_here')

# RAG Settings
RAG_CONFIG = {
    'model_id': MODEL_ID,
    'chroma_path': CHROMA_PATH,
    'collection_name': 'project_patterns',
    'embedding_model': 'all-MiniLM-L6-v2'
}