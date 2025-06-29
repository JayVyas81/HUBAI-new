# user-intent-ml/app.py

from flask import Flask, request, jsonify
import os
import requests
from bs4 import BeautifulSoup
import joblib
from collections import Counter

app = Flask(__name__)

# --- Load the Final Classifier Model ---
model_path = os.path.join(os.path.dirname(__file__), 'models', 'website_classifier.joblib')
try:
    classifier_model = joblib.load(model_path)
    print(f"✅ Final Website Classifier loaded successfully.")
except FileNotFoundError:
    classifier_model = None
    print(f"🚨 WARNING: Classifier model not found. Run `train_classifier.py`.")

def extract_text_from_url(url):
    try:
        response = requests.get(url, timeout=5, headers={'User-Agent': 'Mozilla/5.0'})
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        for script in soup(["script", "style"]):
            script.decompose()
        text = ' '.join(t.get_text() for t in soup.find_all(['p', 'h1', 'h2', 'title']))
        return ' '.join(text.split())
    except Exception:
        return ""

@app.route("/classify", methods=["POST"])
def classify_website():
    if not classifier_model:
        return jsonify({"error": "Classifier model not loaded"}), 500
    
    data = request.get_json()
    url = data.get("url")
    page_text = extract_text_from_url(url) or data.get("title", "")
    
    if not page_text:
        return jsonify({"category": "Unclassified"})
        
    prediction = classifier_model.predict([page_text])
    return jsonify({"category": prediction[0]})

# --- NEW ENDPOINT: Behavioral Summary ---
@app.route("/summarize", methods=["POST"])
def summarize_behavior():
    data = request.get_json()
    intents = data.get("intents", [])

    if len(intents) < 5:
        return jsonify({"summary": "Not enough browsing data to generate a detailed behavioral summary."})

    interest_counts = Counter(intents)
    top_interests = interest_counts.most_common(3)

    summary_parts = []
    if top_interests:
        primary_interest, _ = top_interests[0]
        summary_parts.append(f"This user demonstrates a strong primary interest in '{primary_interest}'.")

        if len(top_interests) > 1:
            secondary_interests = [item[0] for item in top_interests[1:]]
            summary_parts.append(f"They also show significant engagement with topics such as {', '.join(secondary_interests)}.")
        
        summary_parts.append("This pattern suggests a user who is likely using the web for a mix of professional development or research and personal interests.")
    else:
        summary_parts.append("User's browsing habits are very diverse, with no single topic dominating their activity.")

    final_summary = " ".join(summary_parts)
    return jsonify({"summary": final_summary})


if __name__ == "__main__":
    app.run(port=5002)
