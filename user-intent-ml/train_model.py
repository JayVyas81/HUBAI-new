import json
import re
import os
from urllib.parse import urlparse
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import joblib

# Load visits data
with open("data/visits.json", "r") as f:
    visits = json.load(f)

# Load domain-category map for labeling (optional)
with open("domain_category_map.json", "r") as f:
    domain_category = json.load(f)

def extract_domain(url):
    domain = urlparse(url).netloc
    if domain.startswith("www."):
        domain = domain[4:]
    return domain

# Prepare dataset
X = []  # Features: url + title combined text
y = []  # Labels: intent categories

for visit in visits:
    domain = extract_domain(visit["url"])
    category = domain_category.get(domain, "Unknown")  # Default Unknown if not mapped

    # Combine title and domain as text features
    text = visit["title"] + " " + domain
    X.append(text)
    y.append(category)

# Filter unknown category out or keep depending on your approach
# Here we'll keep for training but you can choose to remove

# Train/test split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Build pipeline: TF-IDF + Logistic Regression classifier
model = Pipeline([
    ("tfidf", TfidfVectorizer(stop_words="english", ngram_range=(1,2))),
    ("clf", LogisticRegression(max_iter=500))
])

# Train
model.fit(X_train, y_train)

# Evaluate
y_pred = model.predict(X_test)
print("Accuracy:", accuracy_score(y_test, y_pred))
print(classification_report(y_test, y_pred))

# Save model
os.makedirs("models", exist_ok=True)
joblib.dump(model, "models/intent_classifier.joblib")
print("Model saved to models/intent_classifier.joblib")
