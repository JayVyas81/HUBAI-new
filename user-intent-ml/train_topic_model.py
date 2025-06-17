# user-intent-ml/train_topic_model.py

import json
import re
import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from gensim.corpora import Dictionary
from gensim.models import LdaModel
import os

# --- Download necessary language data (if not already present) ---
try:
    stopwords.words('english')
except LookupError:
    nltk.download('stopwords')

try:
    # This is for the lemmatizer
    nltk.data.find('corpora/wordnet')
except LookupError:
    nltk.download('wordnet')


# --- 1. Load and Preprocess Data ---
print("Loading visits data...")
try:
    with open("data/visits.json", "r") as f:
        visits = json.load(f)
except FileNotFoundError:
    print("Error: `data/visits.json` not found. Please ensure the file exists and contains your browsing data.")
    exit()

if not visits:
    print("Error: `visits.json` is empty. Please browse with the extension to collect data first.")
    exit()

# Combine title and URL for text content
documents = [visit.get('title', '') + ' ' + visit.get('url', '') for visit in visits]
print(f"Loaded {len(documents)} documents.")

# Text cleaning
stop_words = set(stopwords.words('english'))
lemmatizer = WordNetLemmatizer()

def preprocess(text):
    if not text:
        return []
    text = re.sub(r'\W', ' ', text) # Remove all non-word characters
    text = text.lower() # Convert to lowercase
    tokens = text.split()
    processed_tokens = [lemmatizer.lemmatize(word) for word in tokens if word not in stop_words and len(word) > 3]
    return processed_tokens

print("Preprocessing text...")
processed_docs = [preprocess(doc) for doc in documents]
# Filter out any empty documents that might result after preprocessing
processed_docs = [doc for doc in processed_docs if doc]

if not processed_docs:
    print("Error: After preprocessing, no valid words were found in the documents. The dataset might be too small or contain only common words.")
    exit()


# --- 2. Create Dictionary and Corpus ---
print("Creating dictionary and corpus...")
# Create a dictionary representation of the documents
dictionary = Dictionary(processed_docs)

# --- THIS IS THE FIX ---
# The filtering parameters have been made less strict to handle smaller datasets.
# It will now keep words that appear in at least 1 document and in less than 90% of all documents.
dictionary.filter_extremes(no_below=1, no_above=0.9)

# Create a bag-of-words corpus
corpus = [dictionary.doc2bow(doc) for doc in processed_docs]


# --- 3. Train the LDA Topic Model ---
print("Training LDA topic model...")
# Determine the number of topics. It cannot be more than the number of documents.
num_topics = min(5, len(processed_docs)) 
print(f"Using {num_topics} topics for the model.")

# Train the model
lda_model = LdaModel(
    corpus=corpus,
    id2word=dictionary,
    num_topics=num_topics,
    random_state=100,
    update_every=1,
    chunksize=100,
    passes=10,
    alpha='auto',
    per_word_topics=True
)

# --- 4. Save the Model and Dictionary ---
print("Saving model and dictionary...")
output_dir = "models"
os.makedirs(output_dir, exist_ok=True)
lda_model.save(os.path.join(output_dir, 'lda_topic_model.model'))
dictionary.save(os.path.join(output_dir, 'lda_dictionary.dict'))

print("\n--- Topic Model Training Complete ---")
print("Top words for each discovered topic:")
for idx, topic in lda_model.print_topics(-1):
    print(f"Topic: {idx} \nWords: {topic}\n")
