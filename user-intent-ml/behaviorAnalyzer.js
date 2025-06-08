const tf = require("@tensorflow/tfjs-node");
const natural = require("natural");
const { clusterVisits } = require("./clusterVisits");

class BehaviorAnalyzer {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.tfModel = null;
    this.behaviorProfiles = new Map();
  }

  async initialize() {
    // Load pre-trained model or create new one
    this.tfModel = await this.loadModel();
  }

  async analyzeVisit(visit) {
    // 1. Content Analysis
    const contentFeatures = this.extractContentFeatures(visit);

    // 2. Temporal Patterns
    const temporalFeatures = this.extractTemporalFeatures(visit);

    // 3. Interaction Analysis
    const interactionFeatures = this.extractInteractionFeatures(
      visit.activities
    );

    // Combine all features
    const featureVector = [
      ...contentFeatures,
      ...temporalFeatures,
      ...interactionFeatures,
    ];

    // Predict intent
    const intent = await this.predictIntent(featureVector);

    // Update user behavior profile
    this.updateUserProfile(visit.userId, {
      intent,
      features: featureVector,
      timestamp: new Date(),
    });

    return intent;
  }

  extractContentFeatures(visit) {
    const url = new URL(visit.url);
    const pathTokens = this.tokenizer.tokenize(url.pathname);

    // Domain-specific features
    const isShopping = ["amazon", "ebay", "shop"].some((term) =>
      url.hostname.includes(term)
    );

    // Title/keyword analysis
    const titleTokens = this.tokenizer.tokenize(visit.title || "");
    const researchKeywords = ["study", "research", "article", "paper"];
    const isResearch = researchKeywords.some((kw) =>
      titleTokens.some((t) => t.toLowerCase().includes(kw))
    );

    return [
      isShopping ? 1 : 0,
      isResearch ? 1 : 0,
      pathTokens.length / 10, // Normalized
      url.searchParams.toString().length > 0 ? 1 : 0,
    ];
  }

  extractTemporalFeatures(visit) {
    const visitHour = new Date(visit.openTime).getHours();
    const durationMinutes = visit.timeSpent / 60;

    // Normalized values
    return [
      visitHour / 24, // Time of day
      Math.min(durationMinutes, 120) / 120, // Capped at 2 hours
      new Date(visit.openTime).getDay() / 7, // Day of week
    ];
  }

  extractInteractionFeatures(activities = []) {
    const counts = {
      click: 0,
      scroll: 0,
      typing: 0,
      idle: 0,
    };

    activities.forEach((activity) => {
      counts[activity.eventType] = (counts[activity.eventType] || 0) + 1;
    });

    const total = Math.max(1, activities.length);
    return [
      counts.click / total,
      counts.scroll / total,
      counts.typing / total,
      counts.idle / total,
    ];
  }

  async predictIntent(featureVector) {
    // If model exists, use it
    if (this.tfModel) {
      const prediction = this.tfModel.predict(tf.tensor2d([featureVector]));
      const intents = ["Research", "Shopping", "Entertainment", "Work"];
      const predictedIndex = prediction.argMax(1).dataSync()[0];
      return intents[predictedIndex] || "Unknown";
    }

    // Fallback to rules-based approach
    const [isShopping] = featureVector;
    return isShopping > 0.7 ? "Shopping" : "Unknown";
  }

  updateUserProfile(userId, data) {
    if (!this.behaviorProfiles.has(userId)) {
      this.behaviorProfiles.set(userId, { history: [] });
    }

    const profile = this.behaviorProfiles.get(userId);
    profile.history.push(data);

    // Auto-cluster similar visits weekly
    if (profile.history.length % 7 === 0) {
      this.identifyBehaviorPatterns(userId);
    }
  }

  async identifyBehaviorPatterns(userId) {
    const profile = this.behaviorProfiles.get(userId);
    const clusters = await clusterVisits(profile.history);

    // Update profile with discovered patterns
    profile.patterns = clusters.reduce((acc, cluster) => {
      const commonIntent = cluster.mostCommonIntent();
      acc[commonIntent] = cluster.getTimeStats();
      return acc;
    }, {});
  }

  async loadModel() {
    try {
      // Try loading pre-trained model
      return await tf.loadLayersModel("file://./models/intent-model.json");
    } catch {
      // Fallback to simple model
      const model = tf.sequential();
      model.add(
        tf.layers.dense({ units: 8, inputShape: [10], activation: "relu" })
      );
      model.add(tf.layers.dense({ units: 5, activation: "softmax" }));
      return model;
    }
  }
}

module.exports = new BehaviorAnalyzer();
