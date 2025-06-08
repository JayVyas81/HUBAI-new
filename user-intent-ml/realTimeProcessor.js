const BehaviorAnalyzer = require("./behaviorAnalyzer");
const moment = require("moment");

class RealTimeProcessor {
  constructor() {
    this.sessions = new Map();
    this.analyzer = BehaviorAnalyzer;
  }

  async processActivity(activity) {
    // 1. Get or create session
    const session = this.getUserSession(activity.userId);

    // 2. Update session state
    this.updateSession(session, activity);

    // 3. Check for behavior changes
    if (this.detectBehaviorChange(session)) {
      await this.handleBehaviorChange(session);
    }

    // 4. Save significant events
    if (this.isSignificantEvent(activity)) {
      await this.saveEvent(activity);
    }
  }

  getUserSession(userId) {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, {
        lastActivities: [],
        currentBehavior: null,
        behaviorStartTime: null,
        context: {},
      });
    }
    return this.sessions.get(userId);
  }
}
