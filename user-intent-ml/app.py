# user-intent-ml/app.py

from flask import Flask, request, jsonify
import os
import requests
from bs4 import BeautifulSoup
import re
from gensim.corpora import Dictionary
from gensim.models import LdaModel
import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer

# --- Initialization ---
app = Flask(__name__)

# --- Load Models and Preprocessing Tools ---
output_dir = "models"
try:
    dictionary = Dictionary.load(os.path.join(output_dir, 'lda_dictionary.dict'))
    lda_model = LdaModel.load(os.path.join(output_dir, 'lda_topic_model.model'))
    stop_words = set(stopwords.words('english'))
    lemmatizer = WordNetLemmatizer()
    print("✅ Topic model and dictionary loaded successfully.")
except FileNotFoundError:
    dictionary = None
    lda_model = None
    print("🚨 WARNING: Topic model not found. Please run `train_topic_model.py` first.")

def preprocess(text):
    """Preprocesses text for the topic model."""
    if not text:
        return []
    text = re.sub(r'\W', ' ', text)
    text = text.lower()
    tokens = text.split()
    return [lemmatizer.lemmatize(word) for word in tokens if word not in stop_words and len(word) > 3]

def extract_text_from_url(url):
    """Fetches a URL and extracts meaningful text."""
    try:
        response = requests.get(url, timeout=5, headers={'User-Agent': 'Mozilla/5.0'})
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        for script_or_style in soup(["script", "style"]):
            script_or_style.decompose()
        text_parts = [tag.get_text() for tag in soup.find_all(['p', 'h1', 'h2', 'h3', 'title'])]
        return ' '.join(' '.join(text_parts).split())
    except requests.RequestException as e:
        print(f"Error fetching URL {url}: {e}")
        return ""

# --- API Endpoint for Topic Analysis ---
@app.route("/analyze_topics", methods=["POST"])
def analyze_topics():
    if not lda_model or not dictionary:
        return jsonify({"error": "Model not loaded"}), 500

    data = request.get_json()
    url = data.get("url", "")
    title = data.get("title", "")
    
    if not url:
        return jsonify({"error": "Missing 'url' in request"}), 400
    
    # Analyze the page content, falling back to title if needed
    page_text = extract_text_from_url(url)
    if not page_text:
        page_text = title

    # Preprocess the text and get the topic distribution
    processed_text = preprocess(page_text)
    bow = dictionary.doc2bow(processed_text)
    topics = lda_model.get_document_topics(bow, minimum_probability=0.1)

    # Format the topics for the response
    # You can name your topics based on the keywords you saw during training
    # For now, we'll just use "Topic X"
    topic_distribution = {f"Topic {topic_id}": float(prob) for topic_id, prob in topics}
    
    return jsonify({"topics": topic_distribution})


# Health check endpoint
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "model_loaded": lda_model is not None})

if __name__ == "__main__":
    app.run(port=5002, debug=True)
