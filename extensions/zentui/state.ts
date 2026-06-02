import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	type UsageTotals,
	buildCacheReadLabel,
	buildContextLabel,
	buildCostLabel,
	buildTokenLabel,
	buildTotalTokenCountLabel,
	formatProviderLabel,
	getUsageTotals,
} from "./format";
import type { GitStatusSummary } from "./git";
import type { RuntimeInfo } from "./runtime";

export type FooterState = GitStatusSummary & {
	modelLabel: string;
	providerLabel: string;
	contextLabel: string;
	tokenLabel: string;
	totalTokenCountLabel: string;
	costLabel: string;
	lastTurnStartedAt?: number;
	lastTurnDurationLabel: string;
	lastTurnTokenLabel: string;
	lastTurnCacheReadLabel: string;
	lastTurnCostLabel: string;
	runtime?: RuntimeInfo;
};

export function createInitialState(gitDefaults: GitStatusSummary): FooterState {
	return {
		modelLabel: "no-model",
		providerLabel: "Unknown",
		contextLabel: "--",
		tokenLabel: "↑0 ↓0",
		totalTokenCountLabel: "0",
		costLabel: "$0.000",
		lastTurnStartedAt: undefined,
		lastTurnDurationLabel: "--",
		lastTurnTokenLabel: "↑0 ↓0",
		lastTurnCacheReadLabel: "↻0",
		lastTurnCostLabel: "$0.000",
		runtime: undefined,
		...gitDefaults,
	};
}

export function syncState(state: FooterState, ctx: ExtensionContext): void {
	const totals = getUsageTotals(ctx);
	state.modelLabel = ctx.model?.id ?? "no-model";
	state.providerLabel = formatProviderLabel(ctx.model?.provider);
	state.contextLabel = buildContextLabel(ctx);
	state.tokenLabel = buildTokenLabel(totals);
	state.totalTokenCountLabel = buildTotalTokenCountLabel(totals);
	state.costLabel = buildCostLabel(totals);
}
