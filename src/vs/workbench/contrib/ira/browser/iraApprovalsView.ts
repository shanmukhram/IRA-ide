/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append } from '../../../../base/browser/dom.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize2 } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IIraApprovalItem, IraApprovalsService } from './iraApprovals.js';

export class IraApprovalsView extends ViewPane {
	static readonly ID = 'ira.approvalsView';
	static readonly TITLE = localize2('iraApprovals', 'Approvals');

	private readonly disposables = new DisposableStore();
	private approvalsService!: IraApprovalsService;
	private listContainer!: HTMLElement;

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
		this.approvalsService = this._register(instantiationService.createInstance(IraApprovalsService));
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		container.classList.add('ira-approvals-view');

		const header = append(container, $('.ira-approvals-header'));
		const actions = append(header, $('.ira-approvals-actions'));

		const requestBtn = append(actions, $('button.ira-btn', { type: 'button' }));
		requestBtn.textContent = 'Request approval';
		this.disposables.add({ dispose: () => requestBtn.remove() });
		requestBtn.addEventListener('click', () => {
			void this.commandService.executeCommand('ira.approvals.request');
		});

		const clearBtn = append(actions, $('button.ira-btn.secondary', { type: 'button' }));
		clearBtn.textContent = 'Clear';
		this.disposables.add({ dispose: () => clearBtn.remove() });
		clearBtn.addEventListener('click', () => {
			void this.commandService.executeCommand('ira.approvals.clear');
		});

		this.listContainer = append(container, $('.ira-approvals-list'));
		this.renderList();

		this._register(this.approvalsService.onDidChange(() => this.renderList()));
	}

	private renderList(): void {
		this.listContainer.textContent = '';
		const items = this.approvalsService.getItems();

		if (!items.length) {
			const empty = append(this.listContainer, $('.ira-empty'));
			empty.textContent = 'No approvals yet.';
			return;
		}

		for (const item of items) {
			this.renderItem(item);
		}
	}

	private renderItem(item: IIraApprovalItem): void {
		const row = append(this.listContainer, $('.ira-approval-row'));
		const title = append(row, $('.ira-approval-title'));
		title.textContent = item.title;

		const meta = append(row, $('.ira-approval-meta'));
		meta.textContent = item.status.toUpperCase();

		const buttons = append(row, $('.ira-approval-buttons'));
		if (item.status === 'pending') {
			const approve = append(buttons, $('button.ira-btn.small', { type: 'button' }));
			approve.textContent = 'Approve';
			approve.addEventListener('click', () => {
				void this.commandService.executeCommand('ira.approvals.approve', item.id);
			});

			const reject = append(buttons, $('button.ira-btn.small.secondary', { type: 'button' }));
			reject.textContent = 'Reject';
			reject.addEventListener('click', () => {
				void this.commandService.executeCommand('ira.approvals.reject', item.id);
			});
		}
	}

	override dispose(): void {
		this.disposables.dispose();
		super.dispose();
	}
}
