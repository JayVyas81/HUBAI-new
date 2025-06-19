# Save this file as user-intent-ml/train_classifier.py

import json
import os
import re
import requests
from bs4 import BeautifulSoup
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
import joblib

print("Starting AI Classifier Training...")

# --- 1. Load Labeled Data ---
try:
    with open("data/labeled_data.json", "r") as f:
        labeled_data = json.load(f)
    print(f"Loaded {len(labeled_data)} labeled websites.")
except FileNotFoundError:
    print("Error: `data/labeled_data.json` not found. Please create it and add some examples.")
    exit()

def extract_text_from_url(url):
    """Fetches a URL and extracts meaningful text."""
    try:
        response = requests.get(url, timeout=10, headers={'User-Agent': 'Mozilla/5.0'})
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        for script_or_style in soup(["script", "style"]):
            script_or_style.decompose()
        text_parts = [tag.get_text() for tag in soup.find_all(['p', 'h1', 'h2', 'h3', 'title', 'meta'])]
        full_text = ' '.join(' '.join(text_parts).split())
        return full_text
    except requests.RequestException as e:
        print(f"Could not fetch {url}: {e}")
        return ""

# --- 2. Fetch Content for Each URL ---
print("Fetching content for all websites in the dataset...")
all_text = []
all_labels = []
for item in labeled_data:
    text = extract_text_from_url(item['url'])
    if text:
        all_text.append(text)
        all_labels.append(item['category'])

print(f"Successfully processed {len(all_text)} websites.")

# --- 3. Train the Classifier ---
if not all_text:
    print("No website content could be fetched. Aborting training.")
    exit()

# Split data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(all_text, all_labels, test_size=0.2, random_state=42)

# Create a machine learning pipeline
# It first converts text to numbers (TF-IDF) and then classifies them (Logistic Regression)
pipeline = Pipeline([
    ('tfidf', TfidfVectorizer(stop_words='english', ngram_range=(1, 2), max_df=0.9, min_df=2)),
    ('clf', LogisticRegression(solver='liblinear', random_state=42))
])

print("Training the classification model...")
pipeline.fit(X_train, y_train)

# --- 4. Evaluate and Save the Model ---
print("\n--- Model Evaluation ---")
y_pred = pipeline.predict(X_test)
print(classification_report(y_test, y_pred))

output_dir = "models"
os.makedirs(output_dir, exist_ok=True)
model_path = os.path.join(output_dir, 'website_classifier.joblib')
joblib.dump(pipeline, model_path)

print(f"\n✅ New powerful classifier model saved to: {model_path}")

