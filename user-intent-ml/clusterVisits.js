const kmeans = require("node-kmeans");

class VisitCluster {
  constructor(visits) {
    this.visits = visits;
  }

  mostCommonIntent() {
    const freq = {};
    this.visits.forEach((v) => {
      freq[v.intent] = (freq[v.intent] || 0) + 1;
    });
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  }

  getTimeStats() {
    const hours = this.visits.map((v) => new Date(v.timestamp).getHours());
    return {
      preferredHours: this.calcMode(hours),
      avgDuration:
        this.visits.reduce((sum, v) => sum + v.features[4] * 120, 0) /
        this.visits.length,
    };
  }

  calcMode(numbers) {
    const freq = {};
    numbers.forEach((n) => {
      freq[n] = (freq[n] || 0) + 1;
    });
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  }
}

module.exports = async function clusterVisits(visits, k = 3) {
  if (visits.length < k) k = Math.max(1, visits.length);

  const vectors = visits.map((v) => v.features);
  const clusters = await new Promise((resolve) => {
    kmeans.clusterize(vectors, { k }, (err, res) => {
      if (err) resolve([]);
      else resolve(res);
    });
  });

  return clusters.map(
    (c) => new VisitCluster(c.clusterInd.map((i) => visits[i]))
  );
};
