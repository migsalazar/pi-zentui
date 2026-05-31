import { CustomEditor, type KeybindingsManager, type Theme } from "@earendil-works/pi-coding-agent";
import {
	type Component,
	type EditorTheme,
	type TUI,
	truncateToWidth,
	visibleWidth,
} from "@earendil-works/pi-tui";
import type { PolishedTuiConfig } from "./config";
import { EDITOR_BORDER_FALLBACK, renderStyleForSourceOrFallback, safeThemeFg } from "./style";

type AutocompleteEditorInternals = {
	autocompleteList?: Pick<Component, "render">;
	isShowingAutocomplete?: () => boolean;
};

function clampRenderedLines(lines: string[], width: number): string[] {
	const maxWidth = Math.max(0, width);
	return lines.map((line) => truncateToWidth(line, maxWidth, ""));
}

export class PolishedEditor extends CustomEditor {
	private readonly getConfig: () => PolishedTuiConfig;
	private readonly uiTheme: Theme;

	constructor(
		tui: TUI,
		theme: EditorTheme,
		keybindings: KeybindingsManager,
		uiTheme: Theme,
		getConfig: () => PolishedTuiConfig,
		_getModelMeta: () => { modelLabel: string; providerLabel: string },
		_getThinkingLevel: () => string | undefined,
	) {
		super(tui, theme, keybindings, { paddingX: 0 });
		this.borderColor = (text: string) => safeThemeFg(uiTheme, "border", text);
		this.uiTheme = uiTheme;
		this.getConfig = getConfig;
	}

	private fillLine(content: string, width: number): string {
		const truncated = truncateToWidth(content, Math.max(0, width), "");
		const pad = " ".repeat(Math.max(0, width - visibleWidth(truncated)));
		return `${truncated}${pad}`;
	}

	render(width: number): string[] {
		if (width <= 2) {
			return clampRenderedLines(super.render(width), width);
		}

		const innerWidth = width - 2;
		const rendered = super.render(innerWidth);
		const editorInternals = this as unknown as AutocompleteEditorInternals;
		const isShowingAutocomplete =
			typeof editorInternals.isShowingAutocomplete === "function"
				? Boolean(editorInternals.isShowingAutocomplete())
				: false;

		if (rendered.length < 2) {
			return clampRenderedLines(super.render(width), width);
		}

		const { autocompleteList } = editorInternals;
		const autocompleteCount =
			isShowingAutocomplete && typeof autocompleteList?.render === "function"
				? autocompleteList.render(innerWidth).length
				: 0;
		const editorFrame =
			autocompleteCount > 0 && autocompleteCount < rendered.length
				? rendered.slice(0, -autocompleteCount)
				: rendered;
		const autocompleteLines =
			autocompleteCount > 0 && autocompleteCount < rendered.length
				? rendered.slice(-autocompleteCount)
				: [];

		if (editorFrame.length < 2) {
			return clampRenderedLines(rendered, width);
		}

		const config = this.getConfig();
		const colorSource = config.colorSources.editor;
		const editorLines = editorFrame.slice(1, -1);
		const top = renderStyleForSourceOrFallback(
			this.uiTheme,
			colorSource,
			config.colors.editorBorder,
			EDITOR_BORDER_FALLBACK,
			"─".repeat(width),
		);
		const bottom = renderStyleForSourceOrFallback(
			this.uiTheme,
			colorSource,
			config.colors.editorBorder,
			EDITOR_BORDER_FALLBACK,
			"─".repeat(width),
		);
		const renderedLines = [
			top,
			...editorLines.map((line, index) =>
				this.fillLine(index === 0 ? `❯ ${line}` : `  ${line}`, width),
			),
			bottom,
			...autocompleteLines,
		];

		return clampRenderedLines(renderedLines, width);
	}
}
