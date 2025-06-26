# user-intent-ml/app.py  run this 

from flask import Flask, request, jsonify
import os
import requests
from bs4 import BeautifulSoup
import joblib

# --- Initialization ---
app = Flask(__name__)

# --- Load the NEW Classifier Model ---
model_path = os.path.join(os.path.dirname(__file__), 'models', 'website_classifier.joblib')
try:
    classifier_model = joblib.load(model_path)
    print(f"✅ Website Classifier model loaded successfully from {model_path}")
except FileNotFoundError:
    classifier_model = None
    print(f"🚨 WARNING: Classifier model not found at {model_path}. The /classify endpoint will not work.")
    print("Please run `train_classifier.py` to create the model file.")

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

# --- API Endpoint for Website Classification ---
@app.route("/classify", methods=["POST"])
def classify_website():
    if not classifier_model:
        return jsonify({"error": "Classifier model not loaded"}), 500

    data = request.get_json()
    url = data.get("url", "")
    
    if not url:
        return jsonify({"error": "Missing 'url' in request"}), 400
    
    page_text = extract_text_from_url(url)
    if not page_text:
        return jsonify({"category": "Unclassified"})

    # The model expects a list of items, so we wrap our text in a list
    prediction = classifier_model.predict([page_text])
    
    # Return the prediction as JSON
    return jsonify({"category": prediction[0]})


# Health check endpoint
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "model_loaded": classifier_model is not None})

if __name__ == "__main__":
    app.run(port=5002, debug=True)
