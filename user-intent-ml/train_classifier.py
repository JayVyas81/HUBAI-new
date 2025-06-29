import os
import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
import requests
from bs4 import BeautifulSoup
import time

print("Starting Final AI Classifier Training...")

# --- 1. Load Labeled Data from CSV ---
input_csv_path = os.path.join('data', 'website_classification.csv')
try:
    df = pd.read_csv(input_csv_path)
    if 'Unnamed: 0' in df.columns:
        df = df.drop('Unnamed: 0', axis=1)
    df.rename(columns={'website_url': 'url', 'Category': 'category'}, inplace=True)
    df.dropna(subset=['url', 'category'], inplace=True)
    print(f"Loaded {len(df)} initial rows from {input_csv_path}")
except FileNotFoundError:
    print(f"ERROR: Dataset not found at {input_csv_path}")
    exit()

def extract_text_from_url(url):
    """Fetches a URL and extracts meaningful text."""
    try:
        response = requests.get(url, timeout=10, headers={'User-Agent': 'Mozilla/5.0'})
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        for script_or_style in soup(["script", "style"]):
            script_or_style.decompose()
        text = ' '.join(t.get_text() for t in soup.find_all(['p', 'h1', 'h2', 'h3', 'title', 'meta']))
        return ' '.join(text.split())
    except requests.RequestException:
        return None

# --- 2. Fetch Content for Each URL ---
print("Fetching and processing website content... (This will take several minutes)")
all_text = []
all_labels = []
for index, row in df.iterrows():
    if index % 50 == 0:
        print(f"  Processing row {index+1}/{len(df)}...")
    
    # Ensure URL has a scheme
    url = row['url']
    if not url.startswith('http'):
        url = 'https://' + url

    text = extract_text_from_url(url)
    if text:
        all_text.append(text)
        all_labels.append(row['category'])
    time.sleep(0.05) # Be respectful to servers

print(f"\nSuccessfully processed {len(all_text)} websites.")

# --- 3. Train the Final Classifier ---
if len(all_text) < 50:
    print("Not enough website content could be fetched. Aborting training.")
    exit()

X_train, X_test, y_train, y_test = train_test_split(all_text, all_labels, test_size=0.2, random_state=42)

pipeline = Pipeline([
    ('tfidf', TfidfVectorizer(stop_words='english', max_df=0.9, min_df=3, ngram_range=(1,2))),
    ('clf', LogisticRegression(solver='liblinear', random_state=42))
])

print("Training the final classification model...")
pipeline.fit(X_train, y_train)

# --- 4. Evaluate and Save the Final Model ---
print("\n--- Final Model Evaluation ---")
y_pred = pipeline.predict(X_test)
print(classification_report(y_test, y_pred, zero_division=0))

output_dir = "models"
os.makedirs(output_dir, exist_ok=True)
model_path = os.path.join(output_dir, 'website_classifier.joblib')
joblib.dump(pipeline, model_path)

print(f"\n✅ Final, powerful classifier model saved to: {model_path}")
