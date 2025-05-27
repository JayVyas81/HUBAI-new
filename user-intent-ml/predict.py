import sys
import joblib
from urllib.parse import urlparse

def extract_domain(url):
    domain = urlparse(url).netloc
    if domain.startswith("www."):
        domain = domain[4:]
    return domain

def predict_intent(url, title):
    model = joblib.load("models/intent_classifier.joblib")
    domain = extract_domain(url)
    text = title + " " + domain
    pred = model.predict([text])
    return pred[0]

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python predict.py <url> <title>")
        sys.exit(1)
    url = sys.argv[1]
    title = sys.argv[2]
    intent = predict_intent(url, title)
    print(f"Predicted Intent: {intent}")
