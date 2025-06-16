# Save this file as user-intent-ml/app.py

import joblib
from flask import Flask, request, jsonify
from urllib.parse import urlparse
import os

# --- Initialization ---
app = Flask(__name__)

# --- Load the Trained Model ---
# This line finds the model file and loads it into memory when the server starts.
model_path = os.path.join(os.path.dirname(__file__), 'models', 'intent_classifier.joblib')
try:
    model = joblib.load(model_path)
    print(f"✅ Model loaded successfully from {model_path}")
except FileNotFoundError:
    model = None
    print(f"🚨 WARNING: Model file not found at {model_path}. The /predict endpoint will not work.")
    print("Please run `train_model.py` to create the model file.")

def extract_domain(url):
    """Helper function to get the domain from a URL."""
    try:
        domain = urlparse(url).netloc
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except:
        return ""

# --- API Endpoint ---
@app.route("/predict", methods=["POST"])
def predict():
    """
    Receives a POST request with a 'title' and 'url',
    and returns the predicted intent.
    """
    if not model:
        return jsonify({"error": "Model not loaded. Cannot make predictions."}), 500

    # Get data from the JSON request body
    data = request.get_json()
    title = data.get("title", "")
    url = data.get("url", "")

    if not title or not url:
        return jsonify({"error": "Missing 'title' or 'url' in request"}), 400

    # Prepare the feature text, just like in your training script
    domain = extract_domain(url)
    text_features = title + " " + domain

    # Make the prediction
    # The model expects a list of items, so we wrap our text in a list.
    prediction = model.predict([text_features])

    # Return the prediction as JSON
    # We take the first item from the prediction array.
    return jsonify({"intent": prediction[0]})


# Health check endpoint
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "model_loaded": model is not None})

if __name__ == "__main__":
    # Runs the Flask server on port 5002
    app.run(port=5002, debug=True)

