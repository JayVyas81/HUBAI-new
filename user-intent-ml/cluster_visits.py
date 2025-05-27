import json
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
from urllib.parse import urlparse

# Load data
with open('data/visits.json') as f:
    visits = json.load(f)

# Extract domain helper
def get_domain(url):
    domain = urlparse(url).netloc
    if domain.startswith('www.'):
        domain = domain[4:]
    return domain

# Prepare text data (title + domain)
texts = []
for v in visits:
    domain = get_domain(v['url'])
    texts.append(v['title'] + ' ' + domain)

# Vectorize
vectorizer = TfidfVectorizer(stop_words='english', ngram_range=(1, 2))
X = vectorizer.fit_transform(texts)

# Cluster
k = min(5, len(visits))  # ensures k doesn't exceed number of samples

model = KMeans(n_clusters=k, random_state=42)
clusters = model.fit_predict(X)

# Attach cluster labels to visits
for i, visit in enumerate(visits):
    visit['cluster'] = clusters[i]

# Print some clustered visits for interpretation
for c in range(k):
    print(f"\nCluster {c} visits:")
    for v in visits:
        if v['cluster'] == c:
            print(f" - {v['title']} ({v['url']})")
