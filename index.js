// index.js for Agent 4: Importance Scoring
const { getFirestore } = require('firebase-admin/firestore');
const { initializeApp } = require('firebase-admin/app');

initializeApp();
const firestore = getFirestore();

// This function is triggered when a document in the 'issues' collection is written to.
exports.calculateImportance = async (event, context) => {
  const issueId = context.params.issueId;
  const issueRef = firestore.collection('issues').doc(issueId);

  // The 'event.data' object contains the before and after data of the document.
  // We only need the 'after' data.
  const issueData = event.data.after.data();

  // --- The Scoring Algorithm ---
  let score = 0;

  // 1. Details provided (Base score)
  if (issueData.photo_urls && issueData.photo_urls.length > 0) score += 15;
  if (issueData.video_urls && issueData.video_urls.length > 0) score += 20;
  if (issueData.summary) score += 5;

  // 2. Social proof (#Chained reports and #Upvotes)
  score += (issueData.duplicate_count || 1) * 5;
  score += (issueData.upvotes || 0) * 1;
  
  // 3. Time Decay (more recent is more important)
  const hoursSinceUpdate = (Date.now() - issueData.last_updated.toMillis()) / (1000 * 60 * 60);
  // This decay factor reduces the score by ~50% after 72 hours (3 days)
  const decayFactor = Math.exp(-0.01 * hoursSinceUpdate); 
  let finalScore = score * decayFactor;

  // 4. External Signals (Future enhancement)
  // For example, you could have another service that monitors news/Twitter for keywords
  // like "gas leak" or "power outage" in a specific city area. That service could
  // set a "severity" flag on an issue, which we would read here.
  if (issueData.ai_generated_severity === 'HIGH') {
    finalScore *= 2.0;
  } else if (issueData.ai_generated_severity === 'MEDIUM') {
    finalScore *= 1.5;
  }
  
  // To prevent an infinite loop, we only write if the score has changed.
  if (Math.abs(finalScore - issueData.importance_score) > 0.1) {
    console.log(`Updating score for issue ${issueId} from ${issueData.importance_score} to ${finalScore}`);
    return issueRef.update({ importance_score: finalScore });
  } else {
    console.log(`Score for issue ${issueId} remains unchanged. No update needed.`);
    return null; // No need to write
  }
};