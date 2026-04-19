import { getAIDecision } from "./aiService.js";
import { logger } from "./loggerService.js";
import type { AIDecision, AIPromptData } from "../shared/types.js";

export async function getVotedDecision(
  data: AIPromptData,
  openaiApiKey: string | undefined,
  models: string[],
  retryCount: number,
): Promise<AIDecision> {
  if (models.length === 0) {
    return getAIDecision(data, openaiApiKey, undefined, retryCount);
  }

  // Query all models in parallel
  const decisions = await Promise.all(
    models.map(async (model) => {
      try {
        return await getAIDecision(data, openaiApiKey, model, 0); // no retries for voting models
      } catch {
        return null;
      }
    }),
  );

  const valid = decisions.filter((d): d is AIDecision => d !== null && d.decision !== "HOLD");

  if (valid.length === 0) {
    // All models said HOLD or failed
    return decisions.find((d) => d !== null) ?? {
      decision: "HOLD", confidence: 0, entry: 0, stop_loss: 0, take_profit: 0, reason: "All models returned HOLD or failed",
    };
  }

  // Count votes
  const buyVotes = valid.filter((d) => d.decision === "BUY");
  const sellVotes = valid.filter((d) => d.decision === "SELL");

  let winner: AIDecision;
  if (buyVotes.length > sellVotes.length) {
    // Pick the BUY with highest confidence
    winner = buyVotes.reduce((best, d) => d.confidence > best.confidence ? d : best);
  } else if (sellVotes.length > buyVotes.length) {
    winner = sellVotes.reduce((best, d) => d.confidence > best.confidence ? d : best);
  } else {
    // Tie — pick highest confidence overall
    winner = valid.reduce((best, d) => d.confidence > best.confidence ? d : best);
  }

  // Adjust confidence based on consensus
  const consensusRatio = Math.max(buyVotes.length, sellVotes.length) / valid.length;
  winner = {
    ...winner,
    confidence: winner.confidence * consensusRatio,
    reason: `[${models.length}-model vote: ${buyVotes.length}B/${sellVotes.length}S] ${winner.reason}`,
  };

  await logger.info("AI", `Multi-model vote: ${buyVotes.length} BUY, ${sellVotes.length} SELL → ${winner.decision}`, {
    models: models.length,
    votes: { buy: buyVotes.length, sell: sellVotes.length },
  });

  return winner;
}
