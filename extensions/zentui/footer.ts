import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { PolishedTuiConfig } from "./config";
import { collectExtensionStatusSegments } from "./extension-status";
import { formatCwdLabel } from "./format";
import type { FooterState } from "./state";
import { renderStyleForSource } from "./style";

function layoutWidth(text: string): number {
	return visibleWidth(text.replace(/\u001b\[[0-9;]*m/g, "").replace(/\[[A-Za-z][\w:-]*\]/g, ""));
}

function padEndToWidth(text: string, width: number): string {
	return `${text}${" ".repeat(Math.max(0, width - layoutWidth(text)))}`;
}

function joinStatusTexts(statusTexts: string[], separator: string): string {
	return statusTexts.filter(Boolean).join(separator);
}

function fitStatusTexts(statusTexts: string[], maxWidth: number, separator: string): string {
	if (maxWidth <= 0) return "";

	const fitted: string[] = [];
	for (const text of statusTexts) {
		const candidate = joinStatusTexts([...fitted, text], separator);
		if (layoutWidth(candidate) <= maxWidth) {
			fitted.push(text);
			continue;
		}

		if (fitted.length === 0) {
			return maxWidth > 1 ? truncateToWidth(text, maxWidth, "…") : "";
		}
		break;
	}

	return joinStatusTexts(fitted, separator);
}

function appendStatusArea(base: string, statusText: string, separator: string): string {
	if (!base) return statusText;
	if (!statusText) return base;
	return `${base}${separator}${statusText}`;
}

function prependStatusArea(base: string, statusText: string, separator: string): string {
	if (!base) return statusText;
	if (!statusText) return base;
	return `${statusText}${separator}${base}`;
}

function thinkingStyle(config: PolishedTuiConfig, level: string): string {
	switch (level.toLowerCase()) {
		case "minimal":
			return (
				config.colors.editorThinkingMinimal ?? config.colors.editorThinking ?? config.colors.tokens
			);
		case "low":
			return (
				config.colors.editorThinkingLow ?? config.colors.editorThinking ?? config.colors.tokens
			);
		case "medium":
			return (
				config.colors.editorThinkingMedium ?? config.colors.editorThinking ?? config.colors.tokens
			);
		case "high":
			return (
				config.colors.editorThinkingHigh ?? config.colors.editorThinking ?? config.colors.tokens
			);
		case "xhigh":
			return (
				config.colors.editorThinkingXhigh ?? config.colors.editorThinking ?? config.colors.tokens
			);
		default:
			return config.colors.editorThinking ?? config.colors.tokens;
	}
}

function composeBuiltInFooterContent(left: string, right: string, innerWidth: number): string {
	const leftWidth = layoutWidth(left);
	const rightWidth = layoutWidth(right);
	if (!right) return truncateToWidth(left, innerWidth, "");
	if (!left) {
		const fittedRight = truncateToWidth(right, innerWidth, "");
		return `${" ".repeat(Math.max(0, innerWidth - layoutWidth(fittedRight)))}${fittedRight}`;
	}
	if (leftWidth + 1 + rightWidth <= innerWidth) {
		return `${left}${" ".repeat(innerWidth - leftWidth - rightWidth)}${right}`;
	}

	const rightBudget = Math.max(0, innerWidth - 1);
	const fittedRight = truncateToWidth(right, rightBudget, "");
	const fittedRightWidth = layoutWidth(fittedRight);
	const leftBudget = Math.max(0, innerWidth - fittedRightWidth - 1);
	const fittedLeft = truncateToWidth(left, leftBudget, "");
	return `${fittedLeft}${" ".repeat(Math.max(1, innerWidth - layoutWidth(fittedLeft) - fittedRightWidth))}${fittedRight}`;
}

function composeFooterContent(
	builtInLeft: string,
	builtInRight: string,
	extensionLeft: string[],
	extensionMiddle: string[],
	extensionRight: string[],
	separator: string,
	innerWidth: number,
): string {
	const builtInLeftWidth = layoutWidth(builtInLeft);
	const builtInRightWidth = layoutWidth(builtInRight);
	const minimumGap = builtInLeft && builtInRight ? 1 : 0;

	if (builtInLeftWidth + minimumGap + builtInRightWidth > innerWidth) {
		return composeBuiltInFooterContent(builtInLeft, builtInRight, innerWidth);
	}

	const available = Math.max(0, innerWidth - builtInLeftWidth - builtInRightWidth - minimumGap);
	let remaining = available;
	const leftConnectorWidth = builtInLeft && extensionLeft.length > 0 ? layoutWidth(separator) : 0;
	const rightConnectorWidth =
		builtInRight && extensionRight.length > 0 ? layoutWidth(separator) : 0;
	let leftStatus = "";
	let rightStatus = "";

	if (extensionLeft.length > 0 && extensionRight.length > 0) {
		const leftBudget = Math.max(0, Math.floor(available / 2) - leftConnectorWidth);
		leftStatus = fitStatusTexts(extensionLeft, leftBudget, separator);
		remaining -= leftStatus ? leftConnectorWidth + layoutWidth(leftStatus) : 0;

		const rightBudget = Math.max(0, remaining - rightConnectorWidth);
		rightStatus = fitStatusTexts(extensionRight, rightBudget, separator);
		remaining -= rightStatus ? rightConnectorWidth + layoutWidth(rightStatus) : 0;

		const expandedLeftBudget = Math.max(0, remaining + layoutWidth(leftStatus));
		const expandedLeftStatus = fitStatusTexts(extensionLeft, expandedLeftBudget, separator);
		if (layoutWidth(expandedLeftStatus) > layoutWidth(leftStatus)) {
			remaining += leftStatus ? leftConnectorWidth + layoutWidth(leftStatus) : 0;
			leftStatus = expandedLeftStatus;
			remaining -= leftStatus ? leftConnectorWidth + layoutWidth(leftStatus) : 0;
		}
	} else if (extensionLeft.length > 0) {
		leftStatus = fitStatusTexts(
			extensionLeft,
			Math.max(0, available - leftConnectorWidth),
			separator,
		);
		remaining -= leftStatus ? leftConnectorWidth + layoutWidth(leftStatus) : 0;
	} else if (extensionRight.length > 0) {
		rightStatus = fitStatusTexts(
			extensionRight,
			Math.max(0, available - rightConnectorWidth),
			separator,
		);
		remaining -= rightStatus ? rightConnectorWidth + layoutWidth(rightStatus) : 0;
	}

	const left = appendStatusArea(builtInLeft, leftStatus, separator);
	const right = prependStatusArea(builtInRight, rightStatus, separator);
	const gapWidth = Math.max(0, innerWidth - layoutWidth(left) - layoutWidth(right));
	const middle = fitStatusTexts(extensionMiddle, gapWidth, separator);
	const middleWidth = layoutWidth(middle);

	if (!middle || middleWidth <= 0) {
		return `${left}${" ".repeat(gapWidth)}${right}`;
	}

	const leftPadding = Math.floor((gapWidth - middleWidth) / 2);
	const rightPadding = gapWidth - middleWidth - leftPadding;
	return `${left}${" ".repeat(leftPadding)}${middle}${" ".repeat(rightPadding)}${right}`;
}

export function installFooter(
	ctx: ExtensionContext,
	state: FooterState,
	getConfig: () => PolishedTuiConfig,
	hooks: {
		setRequestRender: (fn: (() => void) | undefined) => void;
		scheduleProjectRefresh: (ctx: ExtensionContext) => void;
		setExtensionStatusesGetter?: (fn: (() => ReadonlyMap<string, string>) | undefined) => void;
		getThinkingLevel?: () => string | undefined;
	},
): void {
	ctx.ui.setFooter((tui, theme, footerData) => {
		hooks.setRequestRender(() => tui.requestRender());
		hooks.setExtensionStatusesGetter?.(() => footerData.getExtensionStatuses());
		const unsubscribeBranch = footerData.onBranchChange(() => {
			hooks.scheduleProjectRefresh(ctx);
			tui.requestRender();
		});

		return {
			dispose: () => {
				unsubscribeBranch();
				hooks.setRequestRender(undefined);
				hooks.setExtensionStatusesGetter?.(undefined);
			},
			invalidate() {},
			render(width: number): string[] {
				if (width <= 0) return [""];
				const config = getConfig();
				const colorSource = config.colorSources.starship;
				const separator = renderStyleForSource(theme, colorSource, config.colors.separator, " | ");
				const innerWidth = Math.max(1, width - 2);
				const cwdLabel = renderStyleForSource(
					theme,
					colorSource,
					config.colors.cwd,
					formatCwdLabel(ctx.cwd, config.icons.cwd),
				);
				const branch = state.branch;
				const contextUsage = ctx.getContextUsage();
				const contextColor =
					contextUsage?.percent !== null && contextUsage?.percent !== undefined
						? contextUsage.percent >= 90
							? config.colors.contextError
							: contextUsage.percent >= 60
								? config.colors.contextWarning
								: config.colors.contextNormal
						: config.colors.contextNormal;
				const gitColor = (text: string) =>
					renderStyleForSource(theme, colorSource, config.colors.gitBranch, text);
				const gitStatusColor = (text: string) =>
					renderStyleForSource(theme, colorSource, config.colors.gitStatus, text);
				const gitIcon = config.icons.git ? gitColor(config.icons.git) : "";
				const allStatus = [
					state.conflicted > 0 ? config.icons.conflicted : "",
					state.stashed ? config.icons.stashed : "",
					state.deleted > 0 ? config.icons.deleted : "",
					state.renamed > 0 ? config.icons.renamed : "",
					state.modified > 0 ? config.icons.modified : "",
					state.typechanged > 0 ? config.icons.typechanged : "",
					state.staged > 0 ? config.icons.staged : "",
					state.untracked > 0 ? config.icons.untracked : "",
				].join("");
				const aheadBehind =
					state.ahead > 0 && state.behind > 0
						? config.icons.diverged
						: state.ahead > 0
							? config.icons.ahead
							: state.behind > 0
								? config.icons.behind
								: "";
				const statusBlock =
					allStatus || aheadBehind ? gitStatusColor(`[${allStatus}${aheadBehind}]`) : "";
				const branchLabel = branch
					? [...["on", gitIcon, gitColor(branch)].filter(Boolean), statusBlock]
							.filter(Boolean)
							.join(" ")
					: "";
				const left = [cwdLabel, branchLabel].filter(Boolean).join(" ");
				const thinkingLevel = hooks.getThinkingLevel?.();
				const showModelProvider = innerWidth >= 60;
				const modelSeparator = renderStyleForSource(
					theme,
					colorSource,
					config.colors.separator,
					" · ",
				);
				const modelRight = [
					showModelProvider
						? renderStyleForSource(
								theme,
								colorSource,
								config.colors.editorModel ?? config.colors.tokens,
								state.modelLabel,
							)
						: "",
					showModelProvider
						? renderStyleForSource(
								theme,
								colorSource,
								config.colors.editorProvider ?? config.colors.tokens,
								state.providerLabel,
							)
						: "",
					thinkingLevel && thinkingLevel !== "off"
						? renderStyleForSource(
								theme,
								colorSource,
								thinkingStyle(config, thinkingLevel),
								thinkingLevel,
							)
						: "",
				]
					.filter(Boolean)
					.join(modelSeparator);
				const telemetrySeparator = renderStyleForSource(
					theme,
					colorSource,
					config.colors.separator,
					" ",
				);
				const lastTurnLabel = `Δ${state.lastTurnDurationLabel} ${state.lastTurnTokenLabel} ${state.lastTurnCacheReadLabel}`;
				const sessionUsageLabel = `${renderStyleForSource(
					theme,
					colorSource,
					config.colors.tokens,
					`Σ${state.totalTokenCountLabel}`,
				)} ${renderStyleForSource(theme, colorSource, config.colors.cost, state.costLabel)}`;
				const usageRight = [
					renderStyleForSource(theme, colorSource, config.colors.tokens, lastTurnLabel),
					renderStyleForSource(theme, colorSource, contextColor, state.contextLabel),
					sessionUsageLabel,
				]
					.filter(Boolean)
					.join(telemetrySeparator);
				const extensionStatuses = collectExtensionStatusSegments(
					footerData.getExtensionStatuses(),
					config,
				);
				const renderExtensionStatus = (text: string) =>
					renderStyleForSource(theme, colorSource, config.colors.extensionStatus, text);
				const topContent = composeFooterContent(
					left,
					modelRight,
					extensionStatuses.left.map((segment) => renderExtensionStatus(segment.text)),
					extensionStatuses.middle.map((segment) => renderExtensionStatus(segment.text)),
					extensionStatuses.right.map((segment) => renderExtensionStatus(segment.text)),
					separator,
					innerWidth,
				);
				const bottomContent = composeBuiltInFooterContent("", usageRight, innerWidth);
				const frame = (content: string) =>
					width > 2
						? ` ${layoutWidth(content) <= width - 2 ? content : truncateToWidth(content, width - 2, "")} `
						: content;
				const topLine = frame(topContent);
				const bottomLine = frame(bottomContent);
				return [
					layoutWidth(topLine) <= width ? topLine : truncateToWidth(topLine, width, ""),
					layoutWidth(bottomLine) <= width ? bottomLine : truncateToWidth(bottomLine, width, ""),
				];
			},
		};
	});
}
