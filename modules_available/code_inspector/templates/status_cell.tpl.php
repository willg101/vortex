<div class="status-layout" data-split-id="sidebar" data-split="vertical">
	<div id="context_main" data-role="window" data-window-id="context" data-minimize-icon="sitemap">
		<div class="status-panel css-table">
			<div class="css-row label-row">
				<div class="css-cell" data-hint="Displays the current context (when a session is active); double click an item to alter its value">
					Context <span class="secondary status-indicator blur-hidden"><i class="fa fa-microchip"></i> <span id="mem_usage"></span></span>
					<div class="window-buttons">
						<span class="btn minimize"><i class="fa fa-fw fa-minus"></i></span>
						<span class="btn maximize"><i class="fa fa-fw fa-expand"></i></span>
						<span class="btn demaximize"><i class="fa fa-fw fa-compress"></i></span>
					</div>
				</div>
			</div>
			<div class="css-row">
				<div class="css-cell">
					<div class="scroller">
						<div id="context">
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div id="stack_main" data-role="window" data-window-id="stack" data-minimize-icon="sort-amount-asc">
		<div class="css-table status-panel">
			<div class="css-row label-row ui-resizable-handle ui-resizable-n">
				<div class="css-cell splitter-horizontal" data-hint="Displays the items currently in the stack (when a session is active); click an item to go to jump to the corresponding file and line">
					Stack <span class="secondary status-indicator blur-hidden"><i class="fa fa-sort-amount-desc"></i> <span id="stack_depth"></span></span>
					<div class="window-buttons">
						<span class="btn minimize"><i class="fa fa-fw fa-minus"></i></span>
						<span class="btn maximize"><i class="fa fa-fw fa-expand"></i></span>
						<span class="btn demaximize"><i class="fa fa-fw fa-compress"></i></span>
					</div>
				</div>
			</div>
			<div class="css-row">
				<div class="css-cell">
					<div class="scroller">
						<div id="stack">
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
